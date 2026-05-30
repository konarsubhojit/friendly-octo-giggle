import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { streamCsvResponse } from '@/features/admin/services/admin-csv'
import { getAdminSalesDashboardData } from '@/features/admin/services/admin-sales'
import { apiError, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const sales = await getAdminSalesDashboardData()
    return streamCsvResponse(
      `sales-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Orders', 'Revenue', 'Average Order Value'],
      sales.recentSales.map((point) => [
        point.date,
        point.orders,
        point.revenue,
        point.orders === 0 ? 0 : point.revenue / point.orders,
      ])
    )
  } catch (error) {
    return handleApiError(error)
  }
}
