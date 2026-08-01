// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { AdminSalesDashboardData } from '@/features/admin/services/admin-sales'
import * as AdminPageModule from '@/app/admin/page'

const getAdminSalesDashboardData =
  vi.fn<() => Promise<AdminSalesDashboardData>>()
const checkAdminAuth = vi.fn()
const connection = vi.fn(async () => undefined)
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/server', () => ({
  connection: () => connection(),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}))

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: (permission: string) => checkAdminAuth(permission),
}))

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

const SALES: AdminSalesDashboardData = {
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
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminSalesDashboardData.mockResolvedValue(SALES)
    checkAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'user_1',
      role: 'ADMIN',
    })
  })

  it('opts out of prerendering instead of declaring a segment config', async () => {
    // Under Cache Components the legacy `dynamic = 'force-dynamic'` export is
    // replaced by an explicit `connection()` read.
    expect((AdminPageModule as { dynamic?: string }).dynamic).toBeUndefined()

    render(await AdminPageModule.default())

    expect(connection).toHaveBeenCalledTimes(1)
  })

  it('loads dashboard data and renders the client view', async () => {
    render(await AdminPageModule.default())

    expect(checkAdminAuth).toHaveBeenCalledWith('analytics:read')
    expect(getAdminSalesDashboardData).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sales dashboard: 8')).toBeInTheDocument()
  })

  it('redirects unauthenticated visitors to sign-in', async () => {
    checkAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })

    await expect(AdminPageModule.default()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/signin?callbackUrl=%2Fadmin'
    )
    expect(getAdminSalesDashboardData).not.toHaveBeenCalled()
  })

  it('explains the restriction to staff without analytics access', async () => {
    checkAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - "analytics:read" permission required',
      status: 403,
    })

    render(await AdminPageModule.default())

    expect(screen.getByText('Sales dashboard unavailable')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
    expect(getAdminSalesDashboardData).not.toHaveBeenCalled()
  })
})
