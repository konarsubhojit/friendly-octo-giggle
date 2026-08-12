// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { AdminSalesDashboardData } from '@/features/admin/services/admin-sales'
import * as AdminPageModule from '@/app/admin/page'

const getAdminSalesDashboardData =
  vi.fn<() => Promise<AdminSalesDashboardData>>()
const checkAdminSessionAuth = vi.fn()
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
  checkAdminSessionAuth: () => checkAdminSessionAuth(),
}))

vi.mock('@/lib/constants/roles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants/roles')>()
  return { ...actual }
})

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

vi.mock('@/features/admin/components/AdminPageShell', () => ({
  AdminPageShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AdminPanel: ({
    children,
    title,
  }: {
    children: React.ReactNode
    title?: string
  }) => (
    <div>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  ),
}))

vi.mock('@/features/admin/services/actionable-queues', () => ({
  ACTIONABLE_QUEUES: [
    {
      key: 'orders-awaiting-fulfilment',
      label: 'Orders awaiting fulfilment',
      resource: 'orders',
      filter: { status: 'PENDING' },
      permission: 'orders:read',
      href: '/admin/orders?status=PENDING',
    },
  ],
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
    checkAdminSessionAuth.mockResolvedValue({
      authorized: true,
      userId: 'user_1',
      role: 'ADMIN',
      permissions: [
        'orders:read',
        'orders:update',
        'products:read',
        'products:write',
        'users:read',
        'users:manage',
        'reviews:moderate',
        'coupons:manage',
        'analytics:read',
        'system:manage',
        'orders:refund',
        'orders:returns',
      ],
    })
  })

  it('opts out of prerendering instead of declaring a segment config', async () => {
    expect((AdminPageModule as { dynamic?: string }).dynamic).toBeUndefined()

    render(await AdminPageModule.default())

    expect(connection).toHaveBeenCalledTimes(1)
  })

  it('renders actionable queue section for permitted queues', async () => {
    render(await AdminPageModule.default())

    // The Work Queue section is rendered for staff with any queue permissions
    expect(screen.getByText('Work Queue')).toBeInTheDocument()
  })

  it('redirects unauthenticated visitors to sign-in', async () => {
    checkAdminSessionAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })

    await expect(AdminPageModule.default()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/signin?callbackUrl=%2Fadmin'
    )
    expect(getAdminSalesDashboardData).not.toHaveBeenCalled()
  })

  it('shows analytics section for users with analytics:read', async () => {
    render(await AdminPageModule.default())

    expect(getAdminSalesDashboardData).toHaveBeenCalledTimes(1)
  })

  it('hides analytics section for users without analytics:read', async () => {
    checkAdminSessionAuth.mockResolvedValue({
      authorized: true,
      userId: 'user_2',
      role: 'FULFILMENT',
      permissions: ['orders:read', 'orders:update', 'products:read'],
    })

    render(await AdminPageModule.default())

    expect(getAdminSalesDashboardData).not.toHaveBeenCalled()
  })

  it('still shows queue section for roles without analytics access', async () => {
    checkAdminSessionAuth.mockResolvedValue({
      authorized: true,
      userId: 'user_2',
      role: 'FULFILMENT',
      permissions: ['orders:read', 'orders:update', 'products:read'],
    })

    render(await AdminPageModule.default())

    expect(screen.getByText('Work Queue')).toBeInTheDocument()
  })
})
