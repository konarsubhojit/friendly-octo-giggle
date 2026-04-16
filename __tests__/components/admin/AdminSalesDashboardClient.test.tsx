// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { AdminSalesDashboardClient } from '@/features/admin/components/AdminSalesDashboardClient'
import type { AdminSalesDashboardData } from '@/features/admin/services/admin-sales'

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `$${value.toFixed(2)}`,
    convertPrice: (value: number) => value,
  }),
}))

const sales: AdminSalesDashboardData = {
  totalRevenue: 12500,
  totalOrders: 148,
  todayRevenue: 840,
  todayOrders: 8,
  monthRevenue: 4800,
  monthOrders: 54,
  lastMonthRevenue: 4200,
  lastMonthOrders: 49,
  monthRevenueChange: 14.2,
  monthOrdersChange: 10.2,
  averageOrderValue: 84.45,
  fulfillmentRate: 62.5,
  pendingOrders: 18,
  ordersByStatus: {
    DELIVERED: 50,
    PROCESSING: 12,
    PENDING: 6,
    SHIPPED: 10,
  },
  topProducts: [
    {
      productId: 'prod001',
      name: 'Rose Gift Box',
      totalQuantity: 22,
      totalRevenue: 1800,
    },
    {
      productId: 'prod002',
      name: 'Custom Name Mug',
      totalQuantity: 16,
      totalRevenue: 960,
    },
  ],
  recentSales: [
    { date: '2026-03-16', label: 'Mon', revenue: 500, orders: 4 },
    { date: '2026-03-17', label: 'Tue', revenue: 620, orders: 5 },
    { date: '2026-03-18', label: 'Wed', revenue: 710, orders: 6 },
    { date: '2026-03-19', label: 'Thu', revenue: 540, orders: 4 },
    { date: '2026-03-20', label: 'Fri', revenue: 860, orders: 8 },
    { date: '2026-03-21', label: 'Sat', revenue: 920, orders: 9 },
    { date: '2026-03-22', label: 'Sun', revenue: 650, orders: 7 },
  ],
  totalCustomers: 92,
}

describe('AdminSalesDashboardClient', () => {
  it('renders the upgraded dashboard sections with sales data', () => {
    render(<AdminSalesDashboardClient sales={sales} />)

    expect(
      screen.getByRole('heading', {
        name: 'Sales dashboard with faster first render and clearer signals.',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Revenue Pulse' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('$4800.00')).toHaveLength(2)
    expect(screen.getByText('+14.2% vs last month')).toBeInTheDocument()
    expect(screen.getByText('Rose Gift Box')).toBeInTheDocument()
    expect(screen.getByText('DELIVERED')).toBeInTheDocument()
    expect(screen.getByText('Products').closest('a')).toHaveAttribute(
      'href',
      '/admin/products'
    )
  })
})
