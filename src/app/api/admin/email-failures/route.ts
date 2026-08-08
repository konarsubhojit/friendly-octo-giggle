import { NextRequest } from 'next/server'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
  parseJsonBody,
} from '@/lib/api-utils'
import {
  getFailedEmails,
  acknowledgePendingEmails,
  batchRetryFailedEmails,
} from '@/lib/email/failed-emails'
import type { FailedEmailStatus } from '@/lib/email/failed-emails'
import {
  FailedEmailQuerySchema,
  ManualRetryBodySchema,
} from '@/features/admin/validations'

const parseStatusList = (statusParam: string): FailedEmailStatus[] => {
  const valid = new Set<FailedEmailStatus>(['pending', 'failed', 'sent'])
  return statusParam
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is FailedEmailStatus => valid.has(s as FailedEmailStatus))
}

const extractQueryParams = (url: URL) => ({
  status: url.searchParams.get('status') ?? undefined,
  page: url.searchParams.get('page') ?? undefined,
  pageSize: url.searchParams.get('pageSize') ?? undefined,
  sortOrder: url.searchParams.get('sortOrder') ?? undefined,
})

const fetchEmailRecords = async (filters: {
  statusList: FailedEmailStatus[]
  page: number
  pageSize: number
  sortOrder: 'asc' | 'desc'
}) => {
  const { records, total } = await getFailedEmails(filters)
  const pendingIds = records
    .filter((r) => r.status === 'pending')
    .map((r) => r.id)
  if (pendingIds.length > 0) {
    await acknowledgePendingEmails(pendingIds)
  }
  return { records, total }
}

export const GET = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth('system:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const rawQuery = extractQueryParams(new URL(request.url))
    const parseResult = FailedEmailQuerySchema.safeParse(rawQuery)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }

    const { status, page, pageSize, sortOrder } = parseResult.data
    const statusList = parseStatusList(status)
    if (statusList.length === 0) {
      return apiError('Invalid status filter values', 400)
    }

    const { records, total } = await fetchEmailRecords({
      statusList,
      page,
      pageSize,
      sortOrder,
    })
    const totalPages = Math.ceil(total / pageSize)

    return apiSuccess({
      records,
      pagination: { page, pageSize, total, totalPages },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export const POST = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth('system:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { ids } = await parseJsonBody(request, ManualRetryBodySchema)
    const results = await batchRetryFailedEmails(ids)

    return apiSuccess({ results })
  } catch (error) {
    return handleApiError(error)
  }
}
