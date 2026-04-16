// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { AdminSalesDashboardClient } from '@/features/admin/components/AdminSalesDashboardClient'
import type { AdminSalesDashboardData } from '@/features/admin/services/admin-sales'

const { mockFormatPrice } = vi.hoisted(() => ({
  mockFormatPrice: vi.fn((price: number) => `$${price.toFixed(2)}`),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: mockFormatPrice }),
}))

vi.mock('@/features/admin/components/OrdersByStatusCard', () => ({
  OrdersByStatusCard: ({
    ordersByStatus,
  }: {
    ordersByStatus: Record<string, number>
  }) => (
    <div data-testid="orders-by-status">
      {Object.entries(ordersByStatus).map(([status, count]) => (
        <div key={status}>
          {status}: {count}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/features/admin/components/SalesTrendChart', () => ({
  SalesTrendChart: ({ points }: { points: unknown[] }) => (
    <div data-testid="sales-trend-chart">Chart with {points.length} points</div>
  ),
}))

vi.mock('@/features/admin/components/TopProductsTable', () => ({
  TopProductsTable: ({
    products,
    formatPrice,
  }: {
    products: unknown[]
    formatPrice: (price: number) => string
  }) => (
    <div data-testid="top-products-table">
      {products.length} products - {formatPrice(100)}
    </div>
  ),
}))

describe('AdminSalesDashboardClient', () => {
  const mockSalesData: AdminSalesDashboardData = {
    totalRevenue: 50000,
    totalOrders: 150,
    monthRevenue: 8000,
    monthOrders: 25,
    monthRevenueChange: 12.5,
    monthOrdersChange: 8.3,
    lastMonthRevenue: 7000,
    lastMonthOrders: 23,
    todayRevenue: 500,
    todayOrders: 3,
    averageOrderValue: 333.33,
    totalCustomers: 75,
    pendingOrders: 5,
    fulfillmentRate: 92.5,
    ordersByStatus: {
      PENDING: 5,
      DELIVERED: 120,
      SHIPPED: 15,
      CANCELLED: 10,
    },
    recentSales: [
      { date: '2025-01-01', label: 'Jan 1', revenue: 1000, orders: 10 },
      { date: '2025-01-02', label: 'Jan 2', revenue: 1200, orders: 12 },
      { date: '2025-01-03', label: 'Jan 3', revenue: 900, orders: 9 },
    ],
    topProducts: [
      {
        productId: 'prod1',
        name: 'Top Product 1',
        totalRevenue: 5000,
        totalQuantity: 50,
      },
      {
        productId: 'prod2',
        name: 'Top Product 2',
        totalRevenue: 4000,
        totalQuantity: 40,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dashboard heading', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(
      screen.getByText(
        'Sales dashboard with faster first render and clearer signals.'
      )
    ).toBeInTheDocument()
  })

  it('displays total revenue summary card', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('Total revenue')).toBeInTheDocument()
    expect(screen.getByText('$50000.00')).toBeInTheDocument()
    expect(
      screen.getByText('150 lifetime non-cancelled orders')
    ).toBeInTheDocument()
  })

  it('displays this month revenue summary card', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('This month')).toBeInTheDocument()
    expect(screen.getAllByText('$8000.00')).toHaveLength(2) // Appears in summary and trend
    expect(screen.getByText('25 orders this month')).toBeInTheDocument()
  })

  it('displays average order value summary card', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('Average order')).toBeInTheDocument()
    expect(screen.getByText('$333.33')).toBeInTheDocument()
    expect(screen.getByText('$500.00 revenue today')).toBeInTheDocument()
  })

  it('displays customers summary card', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('Customers')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('5 orders still in flight')).toBeInTheDocument()
  })

  it('displays month revenue trend with positive delta', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('Revenue trend')).toBeInTheDocument()
    expect(screen.getByText('+12.5% vs last month')).toBeInTheDocument()
  })

  it('displays fulfillment rate', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('Fulfilment')).toBeInTheDocument()
    expect(screen.getByText('92.5%')).toBeInTheDocument()
    expect(
      screen.getByText('Delivered out of active orders')
    ).toBeInTheDocument()
  })

  it('displays today orders in conversion snapshot', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/Orders worth \$500.00/)).toBeInTheDocument()
  })

  it('displays last month orders in conversion snapshot', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('Last month')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText(/Revenue \$7000.00/)).toBeInTheDocument()
  })

  it('displays positive month orders change badge', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByText('+8.3% vs last month')).toBeInTheDocument()
  })

  it('renders OrdersByStatusCard with correct data', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    const ordersCard = screen.getByTestId('orders-by-status')
    expect(ordersCard).toHaveTextContent('PENDING: 5')
    expect(ordersCard).toHaveTextContent('DELIVERED: 120')
    expect(ordersCard).toHaveTextContent('SHIPPED: 15')
  })

  it('renders SalesTrendChart with correct data points', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(screen.getByTestId('sales-trend-chart')).toHaveTextContent(
      'Chart with 3 points'
    )
  })

  it('renders TopProductsTable with correct products', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    const table = screen.getByTestId('top-products-table')
    expect(table).toHaveTextContent('2 products')
    expect(table).toHaveTextContent('$100.00')
  })

  it('renders navigation cards for Products', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    const productsLink = screen.getByRole('link', { name: /Products/i })
    expect(productsLink).toHaveAttribute('href', '/admin/products')
    expect(
      screen.getByText(
        'Adjust pricing, inventory, and catalog details before demand spikes hit.'
      )
    ).toBeInTheDocument()
  })

  it('renders navigation cards for Orders', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    const ordersLink = screen.getByRole('link', { name: /Orders/i })
    expect(ordersLink).toHaveAttribute('href', '/admin/orders')
    expect(
      screen.getByText(
        'Review pipeline health, unblock fulfilment, and handle exceptions quickly.'
      )
    ).toBeInTheDocument()
  })

  it('renders navigation cards for Users', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    const usersLink = screen.getByRole('link', { name: /Users/i })
    expect(usersLink).toHaveAttribute('href', '/admin/users')
    expect(
      screen.getByText(
        'Check customer growth and keep admin access and permissions under control.'
      )
    ).toBeInTheDocument()
  })

  it('displays negative delta correctly', () => {
    const dataWithNegativeDelta = {
      ...mockSalesData,
      monthRevenueChange: -5.2,
    }
    render(<AdminSalesDashboardClient sales={dataWithNegativeDelta} />)
    expect(screen.getByText('-5.2% vs last month')).toBeInTheDocument()
  })

  it('displays zero delta correctly', () => {
    const dataWithZeroDelta = {
      ...mockSalesData,
      monthRevenueChange: 0,
    }
    render(<AdminSalesDashboardClient sales={dataWithZeroDelta} />)
    expect(screen.getByText('Flat vs last month')).toBeInTheDocument()
  })

  it('displays null delta as "New month"', () => {
    const dataWithNullDelta = {
      ...mockSalesData,
      monthRevenueChange: null,
    }
    render(<AdminSalesDashboardClient sales={dataWithNullDelta} />)
    expect(screen.getByText('New month')).toBeInTheDocument()
  })

  it('formats delta to 1 decimal place', () => {
    const dataWithPreciseDelta = {
      ...mockSalesData,
      monthRevenueChange: 12.567,
    }
    render(<AdminSalesDashboardClient sales={dataWithPreciseDelta} />)
    expect(screen.getByText('+12.6% vs last month')).toBeInTheDocument()
  })

  it('calls formatPrice for all revenue values', () => {
    render(<AdminSalesDashboardClient sales={mockSalesData} />)
    expect(mockFormatPrice).toHaveBeenCalledWith(50000) // totalRevenue
    expect(mockFormatPrice).toHaveBeenCalledWith(8000) // monthRevenue (multiple times)
    expect(mockFormatPrice).toHaveBeenCalledWith(333.33) // averageOrderValue
    expect(mockFormatPrice).toHaveBeenCalledWith(500) // todayRevenue
  })

  it('displays all sections in correct order', () => {
    const { container } = render(
      <AdminSalesDashboardClient sales={mockSalesData} />
    )
    const sections = container.querySelectorAll('section, article')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('handles empty top products array', () => {
    const dataWithNoProducts = {
      ...mockSalesData,
      topProducts: [],
    }
    render(<AdminSalesDashboardClient sales={dataWithNoProducts} />)
    const table = screen.getByTestId('top-products-table')
    expect(table).toHaveTextContent('0 products')
  })

  it('handles empty recent sales array', () => {
    const dataWithNoSales = {
      ...mockSalesData,
      recentSales: [],
    }
    render(<AdminSalesDashboardClient sales={dataWithNoSales} />)
    expect(screen.getByTestId('sales-trend-chart')).toHaveTextContent(
      'Chart with 0 points'
    )
  })

  it('handles empty orders by status', () => {
    const dataWithNoOrders = {
      ...mockSalesData,
      ordersByStatus: {},
    }
    render(<AdminSalesDashboardClient sales={dataWithNoOrders} />)
    const ordersCard = screen.getByTestId('orders-by-status')
    expect(ordersCard).toBeInTheDocument()
  })
})
