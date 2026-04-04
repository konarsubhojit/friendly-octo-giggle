import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import ProductClient from '@/app/products/[id]/ProductClient'
import type { Product, ProductVariation } from '@/lib/types'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/dynamic', () => ({
  default: vi.fn(() => {
    function ProductAssistantMock() {
      return <div data-testid="product-assistant" />
    }
    return ProductAssistantMock
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    onClick,
  }: {
    children: React.ReactNode
    href: string
    className?: string
    onClick?: () => void
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}))

const mockDispatch = vi.fn()
const mockUnwrap = vi.fn()

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ cart: { cart: null } })
  ),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `₹${amount.toFixed(2)}`,
  }),
}))

const mockAddToCart = vi.fn()
const mockFetchCart = vi.fn()

vi.mock('@/features/cart/store/cartSlice', () => ({
  addToCart: vi.fn((params) => {
    mockAddToCart(params)
    return { type: 'cart/addToCart', params }
  }),
  fetchCart: vi.fn(() => {
    mockFetchCart()
    return { type: 'cart/fetchCart' }
  }),
}))

const mockAddPendingCartItem = vi.fn()

vi.mock('@/features/cart/services/pending-cart', () => ({
  addPendingCartItem: (item: unknown) => mockAddPendingCartItem(item),
}))

vi.mock('@/features/product/components/StockBadge', () => ({
  StockBadge: ({ stock }: { stock: number }) => (
    <div data-testid="stock-badge">{stock > 0 ? 'In Stock' : 'Out of Stock'}</div>
  ),
}))

vi.mock('@/features/product/components/VariationButton', () => ({
  VariationButton: ({
    variation,
    isSelected,
    onSelect,
  }: {
    variation: ProductVariation
    isSelected: boolean
    onSelect: (v: ProductVariation) => void
  }) => (
    <button
      data-testid={`variation-btn-${variation.id}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(variation)}
    >
      {variation.name}
    </button>
  ),
}))

vi.mock('@/features/product/components/ShareButton', () => ({
  ShareButton: () => <button data-testid="share-button">Share</button>,
}))

vi.mock('@/components/ui/DecorativeElements', () => ({
  ButterflyAccent: () => null,
  FlowerAccent: () => null,
}))

vi.mock('@/features/product/components/ImageCarousel', () => ({
  default: ({ images, productName }: { images: string[]; productName: string }) => (
    <div data-testid="image-carousel" aria-label={productName}>
      {images.map((img, i) => (
        <img key={i} src={img} alt={`${productName} ${i}`} />
      ))}
    </div>
  ),
}))

const mockTrackProduct = vi.fn()

vi.mock('@/features/product/hooks/useRecentlyViewed', () => ({
  useRecentlyViewed: () => ({ trackProduct: mockTrackProduct }),
}))

vi.mock('@/features/product/components/RecentlyViewed', () => ({
  default: () => <div data-testid="recently-viewed" />,
}))

vi.mock('@/features/product/components/ReviewsSection', () => ({
  ReviewsSection: () => <div data-testid="reviews-section" />,
}))

vi.mock('@/features/product/components/ProductAssistant', () => ({
  default: () => <div data-testid="product-assistant-component" />,
}))

// ─── Mock Data ────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod001',
    name: 'Rose Bouquet',
    description: 'A beautiful bouquet of red roses.',
    price: 500,
    image: 'https://example.com/rose.jpg',
    images: [],
    stock: 10,
    category: 'Flowers',
    deletedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    variations: [],
    ...overrides,
  }
}

function makeVariation(overrides: Partial<ProductVariation> = {}): ProductVariation {
  return {
    id: 'var001',
    productId: 'prod001',
    name: 'Red',
    designName: 'Classic',
    image: null,
    images: [],
    price: 600,
    variationType: 'colour',
    stock: 5,
    styleId: null,
    deletedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })
    vi.mocked(useSelector).mockImplementation((selector) =>
      selector({ cart: { cart: null } })
    )
    mockDispatch.mockReturnValue({ unwrap: mockUnwrap })
    mockUnwrap.mockResolvedValue({ warning: null, adjustedQuantity: null })
  })

  it('renders product name, price, description, and category', () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getByRole('heading', { name: 'Rose Bouquet' })).toBeInTheDocument()
    expect(screen.getByText('A beautiful bouquet of red roses.')).toBeInTheDocument()
    expect(screen.getAllByText('₹500.00')).toHaveLength(2)
    expect(screen.getByText('Flowers')).toBeInTheDocument()
  })

  it('renders breadcrumb navigation with product name', () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getByText('Rose Bouquet', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop')
  })

  it('renders ImageCarousel with product images', () => {
    const product = makeProduct({ image: 'https://example.com/img.jpg', images: [] })
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getByTestId('image-carousel')).toBeInTheDocument()
  })

  it('renders add-to-cart section when product is in stock', () => {
    const product = makeProduct({ stock: 10 })
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getByRole('button', { name: /Add to Cart/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Select quantity')).toBeInTheDocument()
  })

  it('renders out-of-stock panel when product stock is 0', () => {
    const product = makeProduct({ stock: 0 })
    render(<ProductClient product={product} initialVariationId={null} />)

    // Out-of-stock panel has a "Browse Products" link
    expect(screen.getByRole('link', { name: 'Browse Products' })).toHaveAttribute('href', '/shop')
    expect(screen.queryByRole('button', { name: /Add to Cart/i })).toBeNull()
  })

  it('shows "all stock in cart" panel when cart quantity equals stock', () => {
    const product = makeProduct({ stock: 3 })
    vi.mocked(useSelector).mockImplementation((selector) =>
      selector({
        cart: {
          cart: {
            items: [
              { productId: 'prod001', variationId: null, quantity: 3 },
            ],
          },
        },
      })
    )
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getByText('All Available Stock in Cart')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Cart' })).toHaveAttribute('href', '/cart')
  })

  it('renders share button', () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)
    expect(screen.getByTestId('share-button')).toBeInTheDocument()
  })

  it('renders reviews section and recently viewed', () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)
    expect(screen.getByTestId('reviews-section')).toBeInTheDocument()
    expect(screen.getByTestId('recently-viewed')).toBeInTheDocument()
  })

  it('tracks product view on mount', () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)
    expect(mockTrackProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'prod001', name: 'Rose Bouquet' })
    )
  })

  it('dispatches fetchCart on mount when authenticated', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    })
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cart/fetchCart' })
    )
  })

  it('does NOT dispatch fetchCart when unauthenticated', () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)
    expect(mockFetchCart).not.toHaveBeenCalled()
  })

  it('adds to cart via pending cart when unauthenticated', async () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(mockAddPendingCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'prod001', quantity: 1 })
      )
    })
  })

  it('shows cart success message after adding to cart', async () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Added to cart!')).toBeInTheDocument()
    })
  })

  it('dispatches addToCart when authenticated', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    })
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'prod001', quantity: 1 })
      )
    })
  })

  it('shows error when addToCart rejects', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    })
    mockUnwrap.mockRejectedValue('Out of stock')
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Out of stock')).toBeInTheDocument()
    })
  })

  it('shows stock warning when addToCart returns warning', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    })
    mockUnwrap.mockResolvedValue({
      warning: 'Only 2 available',
      adjustedQuantity: 2,
    })
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Only 2 available')).toBeInTheDocument()
    })
  })

  it('renders variation buttons for colour variations', () => {
    const variations = [
      makeVariation({ id: 'var001', name: 'Red', variationType: 'colour' }),
      makeVariation({ id: 'var002', name: 'Blue', variationType: 'colour' }),
    ]
    const product = makeProduct({ variations })
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getByTestId('variation-btn-var001')).toBeInTheDocument()
    expect(screen.getByTestId('variation-btn-var002')).toBeInTheDocument()
  })

  it('selects initial variation from initialVariationId prop', () => {
    const variation = makeVariation({ id: 'var001', name: 'Red', price: 750 })
    const product = makeProduct({ variations: [variation] })
    render(<ProductClient product={product} initialVariationId="var001" />)

    expect(screen.getAllByText('₹750.00')).toHaveLength(2)
  })

  it('selecting a variation updates the displayed price', () => {
    const variations = [
      makeVariation({ id: 'var001', name: 'Red', price: 750 }),
    ]
    const product = makeProduct({ price: 500, variations })
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getAllByText('₹500.00')).toHaveLength(2)

    act(() => {
      fireEvent.click(screen.getByTestId('variation-btn-var001'))
    })

    expect(screen.getAllByText('₹750.00')).toHaveLength(2)
  })

  it('quantity selector renders with options up to stock (max 10)', () => {
    const product = makeProduct({ stock: 5 })
    render(<ProductClient product={product} initialVariationId={null} />)

    const select = screen.getByLabelText('Select quantity')
    // Stock is 5, so options 1-5 should exist
    expect(select.querySelectorAll('option')).toHaveLength(5)
  })

  it('shows already-in-cart notice when items are in cart', () => {
    const product = makeProduct({ stock: 10 })
    vi.mocked(useSelector).mockImplementation((selector) =>
      selector({
        cart: {
          cart: {
            items: [
              { productId: 'prod001', variationId: null, quantity: 2 },
            ],
          },
        },
      })
    )
    render(<ProductClient product={product} initialVariationId={null} />)

    expect(screen.getByText(/You already have/)).toBeInTheDocument()
    // The cart notice contains "2" in a <strong> tag — check via text function
    expect(
      screen.getByText((_, el) =>
        el?.tagName === 'SPAN' && (el?.textContent ?? '').includes('You already have') && (el?.textContent ?? '').includes('2')
      )
    ).toBeInTheDocument()
  })

  it('shows View Cart link in add-to-cart section', () => {
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)
    expect(screen.getByRole('link', { name: /View Cart/i })).toHaveAttribute('href', '/cart')
  })

  it('shows total price (quantity × price) in add-to-cart section', () => {
    const product = makeProduct({ price: 500 })
    render(<ProductClient product={product} initialVariationId={null} />)
    expect(screen.getAllByText('₹500.00')).toHaveLength(2)
  })

  it('handles generic error thrown by addToCart', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    })
    mockUnwrap.mockRejectedValue(new Error('Network error'))
    const product = makeProduct()
    render(<ProductClient product={product} initialVariationId={null} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
  })
})
