import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrdersClient from '@/app/orders/OrdersClient'

const mockUseCursorPagination = vi.fn()

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: (p: number) => `₹${p}` }),
}))

vi.mock('@/lib/hooks', () => ({
  useCursorPagination: (...args: unknown[]) => mockUseCursorPagination(...args),
}))

vi.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}))

vi.mock('@/components/ui/AlertBanner', () => ({
  AlertBanner: ({ message }: { message: string }) => (
    <div data-testid="alert-banner">{message}</div>
  ),
}))

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title, message }: { title: string; message: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{message}</p>
    </div>
  ),
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/GradientHeading', () => ({
  GradientHeading: ({ children }: { children: React.ReactNode }) => (
    <h1 data-testid="gradient-heading">{children}</h1>
  ),
}))

vi.mock('@/features/orders/components/OrderListCard', () => ({
  OrderListCard: ({ order }: { order: { id: string } }) => (
    <div data-testid={`order-card-${order.id}`}>Order {order.id}</div>
  ),
}))

vi.mock('@/features/orders/components/OrdersSearchForm', () => ({
  OrdersSearchForm: () => <div data-testid="orders-search-form" />,
}))

vi.mock('@/components/ui/CursorPaginationBar', () => ({
  CursorPaginationBar: () => <div data-testid="pagination-bar" />,
}))

const defaultPaginationResult = {
  items: [],
  loading: false,
  error: '',
  search: '',
  searchInput: '',
  hasMore: false,
  currentPage: 1,
  totalCount: 0,
  totalPages: 0,
  setSearchInput: vi.fn(),
  handleSearch: vi.fn(),
  handleFirst: vi.fn(),
  handleNext: vi.fn(),
  handlePrev: vi.fn(),
  handleLast: vi.fn(),
  handlePageSelect: vi.fn(),
  handleRefresh: vi.fn(),
}

describe('OrdersClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCursorPagination.mockReturnValue(defaultPaginationResult)
  })

  it('renders the My Orders heading', () => {
    render(<OrdersClient />)
    expect(screen.getByText('My Orders')).toBeInTheDocument()
  })

  it('renders the search form', () => {
    render(<OrdersClient />)
    expect(screen.getByTestId('orders-search-form')).toBeInTheDocument()
  })

  it('shows loading spinner when loading', () => {
    mockUseCursorPagination.mockReturnValue({
      ...defaultPaginationResult,
      loading: true,
    })
    render(<OrdersClient />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('shows error alert when error exists', () => {
    mockUseCursorPagination.mockReturnValue({
      ...defaultPaginationResult,
      error: 'Something went wrong',
    })
    render(<OrdersClient />)
    expect(screen.getByTestId('alert-banner')).toHaveTextContent(
      'Something went wrong'
    )
  })

  it('shows empty state when no orders and no search', () => {
    render(<OrdersClient />)
    expect(screen.getByText('No orders yet')).toBeInTheDocument()
  })

  it('shows search empty state when no orders but search active', () => {
    mockUseCursorPagination.mockReturnValue({
      ...defaultPaginationResult,
      search: 'shoes',
    })
    render(<OrdersClient />)
    expect(screen.getByText('No matching orders')).toBeInTheDocument()
  })

  it('renders order cards when orders exist', () => {
    const orders = [
      {
        id: 'ord1',
        status: 'PENDING',
        createdAt: '2024-01-01',
        totalAmount: 100,
        items: [],
      },
      {
        id: 'ord2',
        status: 'DELIVERED',
        createdAt: '2024-01-02',
        totalAmount: 200,
        items: [],
      },
    ]
    mockUseCursorPagination.mockReturnValue({
      ...defaultPaginationResult,
      items: orders,
    })
    render(<OrdersClient />)
    expect(screen.getByTestId('order-card-ord1')).toBeInTheDocument()
    expect(screen.getByTestId('order-card-ord2')).toBeInTheDocument()
  })

  it('renders pagination bar when orders exist', () => {
    mockUseCursorPagination.mockReturnValue({
      ...defaultPaginationResult,
      items: [
        {
          id: 'ord1',
          status: 'PENDING',
          createdAt: '2024-01-01',
          totalAmount: 100,
          items: [],
        },
      ],
    })
    render(<OrdersClient />)
    expect(screen.getByTestId('pagination-bar')).toBeInTheDocument()
  })

  it('passes correct options to useCursorPagination', () => {
    render(<OrdersClient />)
    expect(mockUseCursorPagination).toHaveBeenCalledWith({
      url: '/api/orders',
      dataKey: 'orders',
      enabled: true,
    })
  })
})
