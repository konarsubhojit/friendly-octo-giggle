import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import AdminCheckoutRequestsPage from '@/app/admin/checkout-requests/page'

const mockGetRecentCheckoutRequests = vi.hoisted(() => vi.fn())

const mockRecords = [
  {
    id: 'CHK1001',
    userId: 'user-1',
    customerName: 'Aisha Khan',
    customerEmail: 'aisha@example.com',
    customerAddress: '12 Park Street, Kolkata 700016',
    itemCount: 2,
    status: 'FAILED',
    errorMessage: 'Insufficient stock for Rose Bouquet',
    orderId: null,
    createdAt: '2026-03-24T08:00:00.000Z',
    updatedAt: '2026-03-24T08:01:00.000Z',
  },
  {
    id: 'CHK1002',
    userId: 'user-2',
    customerName: 'Maya Sen',
    customerEmail: 'maya@example.com',
    customerAddress: '44 Lake Road, Kolkata 700029',
    itemCount: 1,
    status: 'COMPLETED',
    errorMessage: null,
    orderId: 'ORD123ABC',
    createdAt: '2026-03-24T09:30:00.000Z',
    updatedAt: '2026-03-24T09:31:00.000Z',
  },
] as const

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  getRecentCheckoutRequests: mockGetRecentCheckoutRequests,
}))

describe('AdminCheckoutRequestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRecentCheckoutRequests.mockResolvedValue(mockRecords)
  })

  it('renders queue metrics and request rows', async () => {
    render(await AdminCheckoutRequestsPage({}))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Checkout Requests' })
    ).toBeInTheDocument()
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('CHK1001')).toBeInTheDocument()
    expect(screen.getByText('Aisha Khan')).toBeInTheDocument()
    expect(
      screen.getByText('Insufficient stock for Rose Bouquet')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ORD123ABC' })).toHaveAttribute(
      'href',
      '/admin/orders?search=ORD123ABC'
    )
    expect(mockGetRecentCheckoutRequests).toHaveBeenCalledWith({
      limit: 50,
      search: '',
      status: undefined,
    })
  })

  it('passes search and status filters to the queue service', async () => {
    render(
      await AdminCheckoutRequestsPage({
        searchParams: Promise.resolve({
          search: 'maya',
          status: 'COMPLETED',
        }),
      })
    )

    expect(mockGetRecentCheckoutRequests).toHaveBeenCalledWith({
      limit: 50,
      search: 'maya',
      status: 'COMPLETED',
    })
    expect(screen.getByDisplayValue('maya')).toBeInTheDocument()
    expect(screen.getByDisplayValue('COMPLETED')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Showing 2 checkout requests matching "maya" and status COMPLETED.'
      )
    ).toBeInTheDocument()
  })
})
