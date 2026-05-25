// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ReviewsSection } from '@/features/product/components/ReviewsSection'

const mockSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth/react', () => ({
  useSession: mockSession,
}))
vi.mock('next/image', () => ({
  default: (props: React.ComponentProps<'img'>) => (
    <img {...props} alt={props.alt} />
  ),
}))
vi.mock('@/features/product/components/ReviewForm', () => ({
  ReviewForm: ({ productId }: { productId: string }) => (
    <div data-testid="review-form">ReviewForm for {productId}</div>
  ),
}))
vi.mock('@/components/ui/GradientButton', () => ({
  GradientButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
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

describe('ReviewsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    mockSession.mockReturnValue({ data: null })
  })

  it('shows loading spinner initially', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))
    render(<ReviewsSection productId="prod001" />)
    expect(screen.getByLabelText('Loading reviews')).toBeInTheDocument()
  })

  it('shows empty state when no reviews exist', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { reviews: [] } }),
    } as Response)

    render(<ReviewsSection productId="prod001" />)

    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument()
    })
  })

  it('renders reviews when data is fetched', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            reviews: [
              {
                id: 'rev1',
                rating: 5,
                comment: 'Excellent product!',
                isAnonymous: false,
                isVerifiedBuyer: true,
                helpfulCount: 2,
                notHelpfulCount: 0,
                createdAt: '2024-01-15T10:00:00Z',
                user: { name: 'Jane', image: null },
              },
            ],
            summary: {
              totalReviews: 1,
              averageRating: 5,
              ratingBreakdown: [{ rating: 5, count: 1 }],
            },
          },
        }),
    } as Response)

    render(<ReviewsSection productId="prod001" />)

    await waitFor(() => {
      expect(screen.getByText('Excellent product!')).toBeInTheDocument()
      expect(screen.getByText('Jane')).toBeInTheDocument()
      expect(screen.getByText('Verified buyer')).toBeInTheDocument()
    })
  })

  it('shows Anonymous for anonymous reviews', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            reviews: [
              {
                id: 'rev2',
                rating: 3,
                comment: 'It was okay.',
                isAnonymous: true,
                isVerifiedBuyer: false,
                helpfulCount: 0,
                notHelpfulCount: 0,
                createdAt: '2024-01-15T10:00:00Z',
                user: null,
              },
            ],
          },
        }),
    } as Response)

    render(<ReviewsSection productId="prod001" />)

    await waitFor(() => {
      expect(screen.getByText('Anonymous')).toBeInTheDocument()
    })
  })

  it('fetches reviews with correct URL', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { reviews: [] } }),
    } as Response)

    render(<ReviewsSection productId="prod001" />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('productId=prod001')
      )
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('sort=recent'))
    })
  })

  it("shows review form when 'Write a review' is clicked", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { reviews: [] } }),
    } as Response)

    render(<ReviewsSection productId="prod001" />)

    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Write a review'))

    expect(screen.getByTestId('review-form')).toBeInTheDocument()
  })

  it('renders rating summary for multiple reviews', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            reviews: [
              {
                id: 'rev1',
                rating: 5,
                comment: 'Great product!',
                isAnonymous: false,
                isVerifiedBuyer: false,
                helpfulCount: 0,
                notHelpfulCount: 0,
                createdAt: '2024-01-15T10:00:00Z',
                user: { name: 'Jane', image: null },
              },
              {
                id: 'rev2',
                rating: 3,
                comment: 'Average quality.',
                isAnonymous: false,
                isVerifiedBuyer: false,
                helpfulCount: 0,
                notHelpfulCount: 0,
                createdAt: '2024-01-14T10:00:00Z',
                user: { name: 'John', image: null },
              },
            ],
          },
        }),
    } as Response)

    render(<ReviewsSection productId="prod001" />)

    await waitFor(() => {
      expect(screen.getByText('4.0')).toBeInTheDocument()
      expect(screen.getByText('2 reviews')).toBeInTheDocument()
    })
  })
})
