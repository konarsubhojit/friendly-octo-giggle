import { NextRequest } from 'next/server'
import { drizzleDb } from '@/lib/db'
import { orders, users } from '@/lib/schema'
import { desc, lt, ilike, and, or, SQL, count, inArray } from 'drizzle-orm'
import {
  apiSuccess,
  apiError,
  getAdminOffsetLimitError,
  handleApiError,
  parseOffsetParam,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { cacheAdminUsersList } from '@/lib/cache'

const PAGE_SIZE = 20

const parseLimit = (param: string | null, defaultSize: number): number =>
  Math.min(
    Math.max(
      1,
      Number.parseInt(param ?? String(defaultSize), 10) || defaultSize
    ),
    100
  )

const buildWhereConditions = (
  cursor: string | null,
  search: string,
  useOffset = false
): SQL[] => {
  const conditions: SQL[] = []

  if (cursor && !useOffset) {
    const cursorDate = new Date(cursor)
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(users.createdAt, cursorDate))
    }
  }

  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(ilike(users.name, pattern), ilike(users.email, pattern)) as SQL
    )
  }

  return conditions
}

const resolveWhereClause = (conditions: SQL[]) => {
  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}

export const GET = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth('users:read')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unknown error', authCheck.status)
  }

  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const offsetParam = searchParams.get('offset')
    const useOffset = offsetParam !== null
    const search = searchParams.get('search')?.trim() ?? ''
    const limit = parseLimit(searchParams.get('limit'), PAGE_SIZE)
    const offset = useOffset ? parseOffsetParam(offsetParam) : 0

    const offsetError = getAdminOffsetLimitError(offset)
    if (offsetError) {
      return apiError(offsetError, 400)
    }

    const conditions = buildWhereConditions(cursor, search, useOffset)
    const countConditions = buildWhereConditions(null, search)
    const whereClause = resolveWhereClause(conditions)
    const countWhereClause = resolveWhereClause(countConditions)

    const fetcher = async () => {
      const [rows, totalRows] = await Promise.all([
        drizzleDb.query.users.findMany({
          where: whereClause,
          orderBy: [desc(users.createdAt)],
          limit: limit + 1,
          offset: useOffset ? offset : undefined,
        }),
        drizzleDb
          .select({ value: count() })
          .from(users)
          .where(countWhereClause),
      ])

      const hasMore = rows.length > limit
      const pageItems = hasMore ? rows.slice(0, limit) : rows
      const lastItem = pageItems.at(-1)
      const nextCursor =
        hasMore && lastItem ? lastItem.createdAt.toISOString() : null
      const totalCount = Number(totalRows[0]?.value ?? 0)
      const pageIds = pageItems.map((user) => user.id)
      // Count only orders for this page's users: relation hydration would load
      // every historical order row even though the response needs just a count.
      const orderCounts =
        pageIds.length === 0
          ? []
          : await drizzleDb
              .select({ userId: orders.userId, value: count() })
              .from(orders)
              .where(inArray(orders.userId, pageIds))
              .groupBy(orders.userId)
      const orderCountByUserId = new Map(
        orderCounts.map((row) => [row.userId, Number(row.value)])
      )

      const userList = pageItems.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt:
          user.createdAt instanceof Date
            ? user.createdAt.toISOString()
            : user.createdAt,
        updatedAt:
          user.updatedAt instanceof Date
            ? user.updatedAt.toISOString()
            : user.updatedAt,
        image: user.image,
        _count: { orders: orderCountByUserId.get(user.id) ?? 0 },
      }))

      return { users: userList, nextCursor, hasMore, totalCount }
    }

    const result = await cacheAdminUsersList(fetcher, {
      search,
      cursor: useOffset ? null : cursor,
      offset,
      limit,
    })

    return apiSuccess(result, 200, {
      'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=5',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
