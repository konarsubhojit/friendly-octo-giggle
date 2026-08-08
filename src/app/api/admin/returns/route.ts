import { NextRequest } from 'next/server'
import { and, desc, eq, ilike, inArray, lt, or, type SQL } from 'drizzle-orm'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { primaryDrizzleDb } from '@/lib/db'
import { orders, returnRequests } from '@/lib/schema'
import { isReturnStatus } from '@/lib/constants/returns'
import { withItemsAndEvidence } from '@/features/orders/services/return-queue'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * The triage queue.
 *
 * Ordered by `createdAt DESC` and filtered by status so the query is served by
 * the `ReturnRequest_status_createdAt_idx` composite index rather than a sort.
 */
/** Status, search and cursor filters for the queue query. */
const buildFilters = (searchParams: URLSearchParams): SQL[] => {
  const filters: SQL[] = []

  const statuses = searchParams.getAll('status').filter(isReturnStatus)
  if (statuses.length > 0) {
    filters.push(inArray(returnRequests.status, statuses))
  }

  const search = searchParams.get('search')?.trim()
  if (search) {
    const term = `%${search}%`
    const searchMatch = or(
      ilike(returnRequests.orderId, term),
      ilike(orders.customerEmail, term),
      ilike(orders.customerName, term)
    )
    if (searchMatch) filters.push(searchMatch)
  }

  // Keyset pagination on createdAt: stable under concurrent inserts, which
  // OFFSET is not — a new claim would shift every later page.
  const cursor = searchParams.get('cursor')
  if (cursor) {
    const cursorDate = new Date(cursor)
    if (!Number.isNaN(cursorDate.getTime())) {
      filters.push(lt(returnRequests.createdAt, cursorDate))
    }
  }

  return filters
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await checkAdminAuth('orders:returns')
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status)
    }

    const { searchParams } = new URL(request.url)

    const limit = Math.min(
      Math.max(
        Number.parseInt(searchParams.get('limit') ?? '', 10) || DEFAULT_LIMIT,
        1
      ),
      MAX_LIMIT
    )

    const filters = buildFilters(searchParams)

    const rows = await primaryDrizzleDb
      .select({
        id: returnRequests.id,
        orderId: returnRequests.orderId,
        status: returnRequests.status,
        reason: returnRequests.reason,
        customerNote: returnRequests.customerNote,
        decisionReason: returnRequests.decisionReason,
        refundAmount: returnRequests.refundAmount,
        refundId: returnRequests.refundId,
        createdAt: returnRequests.createdAt,
        customerName: orders.customerName,
        customerEmail: orders.customerEmail,
        // Decides which settlement control the UI offers: COD is settled by
        // hand, every other provider through the gateway.
        paymentProvider: orders.paymentProvider,
      })
      .from(returnRequests)
      .innerJoin(orders, eq(returnRequests.orderId, orders.id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(returnRequests.createdAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    return apiSuccess(
      {
        returns: await withItemsAndEvidence(page),
        nextCursor: hasMore
          ? (page[page.length - 1]?.createdAt.toISOString() ?? null)
          : null,
      },
      200,
      PRIVATE_HEADERS
    )
  } catch (error) {
    return handleApiError(error)
  }
}
