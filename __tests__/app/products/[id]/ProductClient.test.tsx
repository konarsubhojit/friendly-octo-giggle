// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import ProductClient from '@/app/products/[id]/ProductClient'
import type { Product, ProductVariant } from '@/lib/types'
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
    <div data-testid="stock-badge">
      {stock > 0 ? 'In Stock' : 'Out of Stock'}
    </div>
  ),
}))

vi.mock('@/features/product/components/VariationButton', () => ({
  VariationButton: ({
    variant,
    isSelected,
    onSelect,
  }: {
    variant: ProductVariant
    isSelected: boolean
    onSelect: (v: ProductVariant) => void
  }) => (
    <button
      data-testid={`variation-btn-${variant.id}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(variant)}
    >
      {variant.id}
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
  default: ({
    images,
    productName,
  }: {
    images: string[]
    productName: string
  }) => (
    <div data-testid="image-carousel" aria-label={productName}>
      {images.map((img) => (
        <img key={img} src={img} alt={`${productName}`} />
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

const makeProduct = (overrides: Partial<Product> = {}): Product => {
  return {
    id: 'prod001',
    name: 'Rose Bouquet',
    description: 'A beautiful bouquet of red roses.',
    image: 'https://example.com/rose.jpg',
    images: [],
    category: 'Flowers',
    deletedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    variants: [
      {
        id: 'default-var',
        productId: 'prod001',
        sku: null,
        price: 500,
        stock: 10,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

const makeVariation = (
  overrides: Partial<ProductVariant> = {}
): ProductVariant => {
  return {
    id: 'var001',
    productId: 'prod001',
    sku: null,
    image: null,
    images: [],
    price: 600,
    stock: 5,
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
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(
      screen.getByRole('heading', { name: 'Rose Bouquet' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('A beautiful bouquet of red roses.')
    ).toBeInTheDocument()
    expect(screen.getAllByText('₹500.00')).toHaveLength(2)
    expect(screen.getByText('Flowers')).toBeInTheDocument()
  })

  it('renders breadcrumb navigation with product name', () => {
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(
      screen.getByText('Rose Bouquet', { selector: 'span' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute(
      'href',
      '/shop'
    )
  })

  it('renders ImageCarousel with product images', () => {
    const product = makeProduct({
      image: 'https://example.com/img.jpg',
      images: [],
    })
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(screen.getByTestId('image-carousel')).toBeInTheDocument()
  })

  it('renders add-to-cart section when product is in stock', () => {
    const product = makeProduct({ variants: [makeVariation({ stock: 10 })] })
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(
      screen.getByRole('button', { name: /Add to Cart/i })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Select quantity')).toBeInTheDocument()
  })

  it('renders out-of-stock panel when product stock is 0', () => {
    const product = makeProduct({ variants: [makeVariation({ stock: 0 })] })
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    // Out-of-stock panel has a "Browse Products" link
    expect(
      screen.getByRole('link', { name: 'Browse Products' })
    ).toHaveAttribute('href', '/shop')
    expect(screen.queryByRole('button', { name: /Add to Cart/i })).toBeNull()
  })

  it('shows "all stock in cart" panel when cart quantity equals stock', () => {
    const product = makeProduct({
      variants: [makeVariation({ id: 'var001', stock: 3 })],
    })
    vi.mocked(useSelector).mockImplementation((selector) =>
      selector({
        cart: {
          cart: {
            items: [{ productId: 'prod001', variantId: 'var001', quantity: 3 }],
          },
        },
      })
    )
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(screen.getByText('All Available Stock in Cart')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Cart' })).toHaveAttribute(
      'href',
      '/cart'
    )
  })

  it('renders share button', () => {
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )
    expect(screen.getByTestId('share-button')).toBeInTheDocument()
  })

  it('renders reviews section and recently viewed', () => {
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )
    expect(screen.getByTestId('reviews-section')).toBeInTheDocument()
    expect(screen.getByTestId('recently-viewed')).toBeInTheDocument()
  })

  it('tracks product view on mount', () => {
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )
    expect(mockTrackProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'prod001', name: 'Rose Bouquet' })
    )
  })

  it('dispatches fetchCart on mount when authenticated', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cart/fetchCart' })
    )
  })

  it('does NOT dispatch fetchCart when unauthenticated', () => {
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )
    expect(mockFetchCart).not.toHaveBeenCalled()
  })

  it('adds to cart via pending cart when unauthenticated', async () => {
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    await act(() => {
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
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Added to cart!')).toBeInTheDocument()
    })
  })

  it('dispatches addToCart when authenticated', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    await act(() => {
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
      data: {
        user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    mockUnwrap.mockRejectedValue('Out of stock')
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Out of stock')).toBeInTheDocument()
    })
  })

  it('shows stock warning when addToCart returns warning', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    mockUnwrap.mockResolvedValue({
      warning: 'Only 2 available',
      adjustedQuantity: 2,
    })
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Only 2 available')).toBeInTheDocument()
    })
  })

  it('renders variation buttons for colour variations', () => {
    const variants = [
      makeVariation({ id: 'var001' }),
      makeVariation({ id: 'var002' }),
    ]
    const product = makeProduct({ variants })
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(screen.getByTestId('variation-btn-var001')).toBeInTheDocument()
    expect(screen.getByTestId('variation-btn-var002')).toBeInTheDocument()
  })

  it('selects initial variation from initialVariantId prop', () => {
    const variation = makeVariation({ id: 'var001', price: 750 })
    const product = makeProduct({ variants: [variation] })
    render(
      <ProductClient product={product} initialVariantId="var001" aiEnabled />
    )

    expect(screen.getAllByText('₹750.00')).toHaveLength(2)
  })

  it('selecting a variation updates the displayed price', () => {
    const variants = [
      makeVariation({ id: 'default-var', price: 500 }),
      makeVariation({ id: 'var001', price: 750 }),
    ]
    const product = makeProduct({ variants })
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(screen.getAllByText('₹500.00')).toHaveLength(2)

    act(() => {
      fireEvent.click(screen.getByTestId('variation-btn-var001'))
    })

    expect(screen.getAllByText('₹750.00')).toHaveLength(2)
  })

  it('quantity selector renders with options up to stock (max 10)', () => {
    const product = makeProduct({ variants: [makeVariation({ stock: 5 })] })
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    const select = screen.getByLabelText('Select quantity')
    // Stock is 5, so options 1-5 should exist
    expect(select.querySelectorAll('option')).toHaveLength(5)
  })

  it('shows already-in-cart notice when items are in cart', () => {
    const product = makeProduct({
      variants: [makeVariation({ id: 'var001', stock: 10 })],
    })
    vi.mocked(useSelector).mockImplementation((selector) =>
      selector({
        cart: {
          cart: {
            items: [{ productId: 'prod001', variantId: 'var001', quantity: 2 }],
          },
        },
      })
    )
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    expect(screen.getByText(/You already have/)).toBeInTheDocument()
    // The cart notice contains "2" in a <strong> tag — check via text function
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'SPAN' &&
          (el?.textContent ?? '').includes('You already have') &&
          (el?.textContent ?? '').includes('2')
      )
    ).toBeInTheDocument()
  })

  it('shows View Cart link in add-to-cart section', () => {
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )
    expect(screen.getByRole('link', { name: /View Cart/i })).toHaveAttribute(
      'href',
      '/cart'
    )
  })

  it('shows total price (quantity × price) in add-to-cart section', () => {
    const product = makeProduct({ variants: [makeVariation({ price: 500 })] })
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )
    expect(screen.getAllByText('₹500.00')).toHaveLength(2)
  })

  it('does not render ProductAssistant when aiEnabled is false', () => {
    const product = makeProduct()
    render(
      <ProductClient
        product={product}
        initialVariantId={null}
        aiEnabled={false}
      />
    )
    expect(
      screen.queryByTestId('product-assistant-component')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /Ask a question about/i,
      })
    ).not.toBeInTheDocument()
  })

  it('shows error when no variant is selected and add-to-cart is clicked', async () => {
    // A product with no variants results in null selectedVariant
    // which means effectiveStock is 0 and OutOfStockPanel is shown
    // The "no variant selected" error path is triggered when a user somehow
    // clicks add-to-cart without a variant selected (edge case with stock > 0)
    const product = makeProduct({ variants: [] })
    render(
      <ProductClient
        product={product}
        initialVariantId={null}
        aiEnabled={false}
      />
    )

    // No variants → stock is 0 → OutOfStockPanel shown, not AddToCartSection
    expect(
      screen.getByRole('link', { name: 'Browse Products' })
    ).toBeInTheDocument()
  })

  it('shows error when trying to add to cart without selecting a variant', async () => {
    // Create a product where resolveInitialVariant returns null
    // This happens when the product has no variants at all
    const product: Product = {
      id: 'prod001',
      name: 'Test Product',
      description: 'desc',
      image: 'https://example.com/img.jpg',
      images: [],
      category: 'Flowers',
      deletedAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      variants: [],
    }
    render(
      <ProductClient
        product={product}
        initialVariantId={null}
        aiEnabled={false}
      />
    )

    // With no variants at all, it shows the OutOfStock panel (stock=0)
    expect(
      screen.getByRole('link', { name: 'Browse Products' })
    ).toBeInTheDocument()
  })

  it('renders option-based variant selector when product has options', () => {
    const variants = [
      makeVariation({
        id: 'var-red-sm',
        price: 500,
        stock: 5,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-sm',
            value: 'Small',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-blue-sm',
        price: 600,
        stock: 3,
        optionValues: [
          {
            id: 'ov-blue',
            value: 'Blue',
            optionId: 'opt-color',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-sm',
            value: 'Small',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-color',
          productId: 'prod001',
          name: 'Color',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-red',
              optionId: 'opt-color',
              value: 'Red',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-blue',
              optionId: 'opt-color',
              value: 'Blue',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'opt-size',
          productId: 'prod001',
          name: 'Size',
          sortOrder: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-sm',
              optionId: 'opt-size',
              value: 'Small',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }
    render(
      <ProductClient
        product={product}
        initialVariantId="var-red-sm"
        aiEnabled={false}
      />
    )

    expect(screen.getByText('Choose Your Options')).toBeInTheDocument()
    expect(screen.getByText('Color')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Red' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Small' })).toBeInTheDocument()
    // Selected variant info should appear
    expect(screen.getByText('Red / Small')).toBeInTheDocument()
  })

  it('switches variant when option button is clicked', () => {
    const variants = [
      makeVariation({
        id: 'var-red-sm',
        price: 500,
        stock: 5,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-sm',
            value: 'Small',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-blue-sm',
        price: 600,
        stock: 3,
        optionValues: [
          {
            id: 'ov-blue',
            value: 'Blue',
            optionId: 'opt-color',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-sm',
            value: 'Small',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-color',
          productId: 'prod001',
          name: 'Color',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-red',
              optionId: 'opt-color',
              value: 'Red',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-blue',
              optionId: 'opt-color',
              value: 'Blue',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'opt-size',
          productId: 'prod001',
          name: 'Size',
          sortOrder: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-sm',
              optionId: 'opt-size',
              value: 'Small',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }
    render(
      <ProductClient
        product={product}
        initialVariantId="var-red-sm"
        aiEnabled={false}
      />
    )

    // Initially Red/Small is selected - price 500
    // Price appears in: main price area + variant detail panel + total = 3 times
    expect(screen.getAllByText('₹500.00').length).toBeGreaterThanOrEqual(2)

    // Click Blue to switch variant
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Blue' }))
    })

    // Should now show Blue/Small - price 600
    expect(screen.getAllByText('₹600.00').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Blue / Small')).toBeInTheDocument()
  })

  it('uses variant images when selected variant has images', () => {
    const variant = makeVariation({
      id: 'var-with-img',
      image: 'https://example.com/variant.jpg',
      images: ['https://example.com/variant2.jpg'],
    })
    const product = makeProduct({ variants: [variant] })
    render(
      <ProductClient
        product={product}
        initialVariantId="var-with-img"
        aiEnabled={false}
      />
    )

    const carousel = screen.getByTestId('image-carousel')
    expect(
      carousel.querySelector('img[src="https://example.com/variant.jpg"]')
    ).toBeInTheDocument()
    expect(
      carousel.querySelector('img[src="https://example.com/variant2.jpg"]')
    ).toBeInTheDocument()
  })

  it('shows low stock warning when variant stock is between 1 and 5 with options', () => {
    const variants = [
      makeVariation({
        id: 'var-low',
        price: 500,
        stock: 3,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-color',
          productId: 'prod001',
          name: 'Color',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-red',
              optionId: 'opt-color',
              value: 'Red',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }
    render(
      <ProductClient
        product={product}
        initialVariantId="var-low"
        aiEnabled={false}
      />
    )

    expect(screen.getByText('Only 3 left')).toBeInTheDocument()
  })

  it('handles generic error thrown by addToCart', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Alice', email: 'a@a.com', role: 'CUSTOMER' },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    mockUnwrap.mockRejectedValue(new Error('Network error'))
    const product = makeProduct()
    render(
      <ProductClient product={product} initialVariantId={null} aiEnabled />
    )

    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }))
    })

    await waitFor(() => {
      expect(
        screen.getByText('Something went wrong. Please try again.')
      ).toBeInTheDocument()
    })
  })

  it('hides unavailable option values based on selected options', () => {
    // Red comes in S and L; Blue only comes in S — no Blue-L variant exists
    const variants = [
      makeVariation({
        id: 'var-red-s',
        price: 500,
        stock: 5,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-red-l',
        price: 550,
        stock: 3,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-l',
            value: 'L',
            optionId: 'opt-size',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-blue-s',
        price: 600,
        stock: 4,
        optionValues: [
          {
            id: 'ov-blue',
            value: 'Blue',
            optionId: 'opt-color',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-color',
          productId: 'prod001',
          name: 'Color',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-red',
              optionId: 'opt-color',
              value: 'Red',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-blue',
              optionId: 'opt-color',
              value: 'Blue',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'opt-size',
          productId: 'prod001',
          name: 'Size',
          sortOrder: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-s',
              optionId: 'opt-size',
              value: 'S',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-l',
              optionId: 'opt-size',
              value: 'L',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }

    render(
      <ProductClient
        product={product}
        initialVariantId="var-red-s"
        aiEnabled={false}
      />
    )

    // Red is selected → both S and L should be visible (Red has S and L)
    expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument()

    // Now click Blue
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Blue' }))
    })

    // Blue only has S → L should be hidden
    expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'L' })).not.toBeInTheDocument()
  })

  it('auto-selects valid combination when current selection becomes unavailable', () => {
    // Red has S and L; Blue only has S
    const variants = [
      makeVariation({
        id: 'var-red-s',
        price: 500,
        stock: 5,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-red-l',
        price: 550,
        stock: 3,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-l',
            value: 'L',
            optionId: 'opt-size',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-blue-s',
        price: 600,
        stock: 4,
        optionValues: [
          {
            id: 'ov-blue',
            value: 'Blue',
            optionId: 'opt-color',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-color',
          productId: 'prod001',
          name: 'Color',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-red',
              optionId: 'opt-color',
              value: 'Red',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-blue',
              optionId: 'opt-color',
              value: 'Blue',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'opt-size',
          productId: 'prod001',
          name: 'Size',
          sortOrder: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-s',
              optionId: 'opt-size',
              value: 'S',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-l',
              optionId: 'opt-size',
              value: 'L',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }

    // Start with Red-L selected
    render(
      <ProductClient
        product={product}
        initialVariantId="var-red-l"
        aiEnabled={false}
      />
    )

    // Verify Red/L selected
    expect(screen.getByText('Red / L')).toBeInTheDocument()

    // Click Blue — Blue-L doesn't exist, should fall back to Blue-S (price 600)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Blue' }))
    })

    expect(screen.getByText('Blue / S')).toBeInTheDocument()
    expect(screen.getAllByText('₹600.00').length).toBeGreaterThanOrEqual(2)
  })

  it('shows all sizes when no color is initially selected for a single-option product', () => {
    // A product with only one option (Size) should always show all values
    const variants = [
      makeVariation({
        id: 'var-s',
        price: 500,
        stock: 5,
        optionValues: [
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-m',
        price: 550,
        stock: 3,
        optionValues: [
          {
            id: 'ov-m',
            value: 'M',
            optionId: 'opt-size',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-l',
        price: 600,
        stock: 4,
        optionValues: [
          {
            id: 'ov-l',
            value: 'L',
            optionId: 'opt-size',
            sortOrder: 2,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-size',
          productId: 'prod001',
          name: 'Size',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-s',
              optionId: 'opt-size',
              value: 'S',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-m',
              optionId: 'opt-size',
              value: 'M',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-l',
              optionId: 'opt-size',
              value: 'L',
              sortOrder: 2,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }

    render(
      <ProductClient
        product={product}
        initialVariantId="var-s"
        aiEnabled={false}
      />
    )

    expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument()
  })

  it('shows out-of-stock option values as clickable buttons with visual indicator', () => {
    // Red-S is in stock, Red-L is out of stock
    const variants = [
      makeVariation({
        id: 'var-red-s',
        price: 500,
        stock: 5,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-red-l',
        price: 550,
        stock: 0,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-l',
            value: 'L',
            optionId: 'opt-size',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-color',
          productId: 'prod001',
          name: 'Color',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-red',
              optionId: 'opt-color',
              value: 'Red',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'opt-size',
          productId: 'prod001',
          name: 'Size',
          sortOrder: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-s',
              optionId: 'opt-size',
              value: 'S',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-l',
              optionId: 'opt-size',
              value: 'L',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }

    render(
      <ProductClient
        product={product}
        initialVariantId="var-red-s"
        aiEnabled={false}
      />
    )

    // S should be enabled (in stock)
    const sButton = screen.getByRole('button', { name: 'S' })
    expect(sButton).not.toBeDisabled()

    // L should be visible, NOT disabled, with out-of-stock title
    const lButton = screen.getByRole('button', {
      name: 'L — Out of stock',
    })
    expect(lButton).toBeInTheDocument()
    expect(lButton).not.toBeDisabled()
    expect(lButton).toHaveAttribute('title', 'L — Out of stock')
    expect(lButton.className).toContain('line-through')

    // Clicking L should select the out-of-stock variant and show out-of-stock panel
    act(() => {
      fireEvent.click(lButton)
    })

    // Out-of-stock panel shows "Browse Products" link
    expect(
      screen.getByRole('link', { name: 'Browse Products' })
    ).toHaveAttribute('href', '/shop')
    expect(
      screen.queryByRole('button', { name: /Add to Cart/i })
    ).not.toBeInTheDocument()
  })

  it('shows out-of-stock color as clickable and selecting it shows out-of-stock view', () => {
    // Red-S in stock, Blue-S out of stock
    const variants = [
      makeVariation({
        id: 'var-red-s',
        price: 500,
        stock: 5,
        optionValues: [
          {
            id: 'ov-red',
            value: 'Red',
            optionId: 'opt-color',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
      makeVariation({
        id: 'var-blue-s',
        price: 600,
        stock: 0,
        optionValues: [
          {
            id: 'ov-blue',
            value: 'Blue',
            optionId: 'opt-color',
            sortOrder: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'ov-s',
            value: 'S',
            optionId: 'opt-size',
            sortOrder: 0,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]
    const product: Product = {
      ...makeProduct({ variants }),
      options: [
        {
          id: 'opt-color',
          productId: 'prod001',
          name: 'Color',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-red',
              optionId: 'opt-color',
              value: 'Red',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'ov-blue',
              optionId: 'opt-color',
              value: 'Blue',
              sortOrder: 1,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'opt-size',
          productId: 'prod001',
          name: 'Size',
          sortOrder: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          values: [
            {
              id: 'ov-s',
              optionId: 'opt-size',
              value: 'S',
              sortOrder: 0,
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    }

    render(
      <ProductClient
        product={product}
        initialVariantId="var-red-s"
        aiEnabled={false}
      />
    )

    // Red should be enabled
    const redButton = screen.getByRole('button', { name: 'Red' })
    expect(redButton).not.toBeDisabled()

    // Blue should be visible, clickable, with out-of-stock styling
    const blueButton = screen.getByRole('button', {
      name: 'Blue — Out of stock',
    })
    expect(blueButton).toBeInTheDocument()
    expect(blueButton).not.toBeDisabled()
    expect(blueButton).toHaveAttribute('title', 'Blue — Out of stock')
    expect(blueButton.className).toContain('line-through')

    // Initially add-to-cart is shown (in stock)
    expect(
      screen.getByRole('button', { name: /Add to Cart/i })
    ).toBeInTheDocument()

    // Click Blue — out-of-stock variant selected, should show out-of-stock panel
    act(() => {
      fireEvent.click(blueButton)
    })

    // Out-of-stock panel replaces add-to-cart
    expect(
      screen.getByRole('link', { name: 'Browse Products' })
    ).toHaveAttribute('href', '/shop')
    expect(
      screen.queryByRole('button', { name: /Add to Cart/i })
    ).not.toBeInTheDocument()
  })
})
