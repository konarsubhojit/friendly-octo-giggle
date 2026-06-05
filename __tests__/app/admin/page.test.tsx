// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { AdminSalesDashboardData } from '@/features/admin/services/admin-sales'
import * as AdminPageModule from '@/app/[locale]/admin/page'

const getAdminSalesDashboardData =
  vi.fn<() => Promise<AdminSalesDashboardData>>()

vi.mock('@/features/admin/services/admin-sales', () => ({
  getAdminSalesDashboardData: () => getAdminSalesDashboardData(),
}))

vi.mock('@/features/admin/components/AdminSalesDashboardClient', () => ({
  AdminSalesDashboardClient: ({
    sales,
  }: {
    sales: AdminSalesDashboardData
  }) => <div>Sales dashboard: {sales.totalOrders}</div>,
}))

describe('AdminDashboard', () => {
  it('forces dynamic rendering for the admin dashboard', () => {
    expect(AdminPageModule.dynamic).toBe('force-dynamic')
  })

  it('loads dashboard data and renders the client view', async () => {
    getAdminSalesDashboardData.mockResolvedValue({
      totalRevenue: 1250,
      totalOrders: 8,
      todayRevenue: 200,
      todayOrders: 2,
      monthRevenue: 900,
      monthOrders: 6,
      lastMonthRevenue: 600,
      lastMonthOrders: 5,
      monthRevenueChange: 50,
      monthOrdersChange: 20,
      averageOrderValue: 156.25,
      fulfillmentRate: 75,
      pendingOrders: 1,
      ordersByStatus: { DELIVERED: 6, PROCESSING: 1, PENDING: 1 },
      topProducts: [],
      recentSales: [],
      totalCustomers: 14,
      revenue7d: 500,
      revenue30d: 900,
      revenue90d: 1200,
      lowStockAlerts: 3,
      emailFailureCount: 1,
    })

    render(await AdminPageModule.default())

    expect(getAdminSalesDashboardData).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sales dashboard: 8')).toBeInTheDocument()
  })
})
