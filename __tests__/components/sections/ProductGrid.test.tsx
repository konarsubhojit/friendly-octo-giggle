// @vitest-environment jsdom
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'
import ProductGrid from '@/features/product/components/ProductGrid'
import type { Product } from '@/lib/types'
import type { ProductGridItem } from '@/features/product/components/ProductGrid'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    href: string
    'aria-label'?: string
  }) => (
    <a href={href} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    priority,
  }: {
    alt: string
    src: string
    priority?: boolean
  }) => (
    <img alt={alt} src={src} data-priority={priority ? 'true' : undefined} />
  ),
}))

const mockDispatch = vi.fn()

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: vi.fn(() => []),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
      expires: '',
    },
    status: 'authenticated',
  })),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    currency: 'INR' as const,
    setCurrency: vi.fn(),
    formatPrice: (v: number) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v),
    convertPrice: (v: number) => v,
    currencySymbol: '₹',
    availableCurrencies: ['INR', 'USD', 'EUR', 'GBP'],
    rates: { INR: 1, USD: 1 / 83.5, EUR: 0.92 / 83.5, GBP: 0.79 / 83.5 },
    ratesLoading: false,
  }),
}))

const makeProduct = (overrides: Partial<Product> = {}): Product => {
  const product = {
    id: '1',
    name: 'Test Product',
    description: 'A nice product',
    image: '/img.jpg',
    images: [],
    category: 'Flowers',
    deletedAt: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    variants: [
      {
        id: 'var-default',
        productId: '1',
        sku: null,
        price: 10,
        stock: 10,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ],
    ...overrides,
  }

  return {
    ...product,
    images: product.images ?? [],
  }
}

const toGridItem = (product: Product): ProductGridItem => {
  const variants = product.variants ?? []
  const price =
    variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0
  const stock = variants.reduce((sum, v) => sum + v.stock, 0)
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price,
    image: product.image,
    stock,
    category: product.category,
  }
}

/** Helper: create a Product with a single variant at the given stock level */
const withVariantStock = (
  stock: number,
  overrides: Partial<Product> = {}
): Product =>
  makeProduct({
    ...overrides,
    variants: [
      {
        id: `var-${overrides.id ?? '1'}`,
        productId: overrides.id ?? '1',
        sku: null,
        price: 10,
        stock,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ],
  })

const ALL_CATEGORIES = [
  'Handbag',
  'Flowers',
  'Flower Pots',
  'Keychains',
  'Hair Accessories',
]

let intersectionCallback: IntersectionObserverCallback | null = null

const mockIntersectionObserver = vi.fn(function (
  this: unknown,
  callback: IntersectionObserverCallback
) {
  intersectionCallback = callback
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }
})

function renderGrid(
  products: Product[],
  categories?: string[],
  props?: Partial<React.ComponentProps<typeof ProductGrid>>
) {
  return render(
    <ProductGrid
      products={products.map(toGridItem)}
      categories={categories}
      {...props}
    />
  )
}

describe('ProductGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    intersectionCallback = null
    mockDispatch.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    vi.stubGlobal('IntersectionObserver', mockIntersectionObserver)
    vi.stubGlobal('fetch', vi.fn())
  })
  it('shows empty state when no products', () => {
    renderGrid([])
    expect(screen.getByText('No products found')).toBeTruthy()
  })

  it('renders product names', () => {
    renderGrid([makeProduct({ name: 'Flower Bouquet' })])
    expect(screen.getByText('Flower Bouquet')).toBeTruthy()
  })

  it('renders product description', () => {
    renderGrid([makeProduct({ description: 'Beautiful flowers' })])
    expect(screen.getByText('Beautiful flowers')).toBeTruthy()
  })

  it('renders category in filter dropdown', () => {
    renderGrid([makeProduct({ category: 'Flowers' })], ['Flowers'])
    const select = screen.getByRole('combobox', {
      name: /filter by category/i,
    })
    expect(select).toBeTruthy()
    const elements = screen.getAllByText('Flowers')
    expect(elements.length).toBeGreaterThan(0)
  })

  it('shows In Stock badge for stock > 5', () => {
    renderGrid([withVariantStock(10)])
    expect(screen.getByText('In Stock')).toBeTruthy()
  })

  it('shows low stock warning for stock 1-5', () => {
    renderGrid([withVariantStock(3)])
    expect(screen.getByText('Only 3 left')).toBeTruthy()
  })

  it('shows Out of Stock for stock 0', () => {
    renderGrid([withVariantStock(0)])
    expect(screen.getByText('Out of Stock')).toBeTruthy()
  })

  it('renders product link with correct href', () => {
    renderGrid([makeProduct({ id: 'prod-42', name: 'My Product' })])
    const link = screen.getByRole('link', { name: /My Product/i })
    expect(link.getAttribute('href')).toBe('/products/prod-42')
  })

  it('renders multiple products', () => {
    renderGrid([
      makeProduct({ id: '1', name: 'Product A' }),
      makeProduct({ id: '2', name: 'Product B' }),
    ])
    expect(screen.getByText('Product A')).toBeTruthy()
    expect(screen.getByText('Product B')).toBeTruthy()
  })

  it('eager loads the first visible product row for faster LCP', () => {
    renderGrid([
      makeProduct({ id: '1', name: 'Product A', image: '/a.jpg' }),
      makeProduct({ id: '2', name: 'Product B', image: '/b.jpg' }),
      makeProduct({ id: '3', name: 'Product C', image: '/c.jpg' }),
      makeProduct({ id: '4', name: 'Product D', image: '/d.jpg' }),
    ])

    const firstImage = screen.getByAltText('Product A')
    const secondImage = screen.getByAltText('Product B')
    const thirdImage = screen.getByAltText('Product C')
    const fourthImage = screen.getByAltText('Product D')

    expect(firstImage).toHaveAttribute('data-priority', 'true')
    expect(secondImage).toHaveAttribute('data-priority', 'true')
    expect(thirdImage).toHaveAttribute('data-priority', 'true')
    expect(fourthImage).not.toHaveAttribute('data-priority', 'true')
  })

  it('renders all products heading', () => {
    renderGrid([])
    expect(screen.getByText(/All Products/i)).toBeTruthy()
  })
  it('renders category filter dropdown with all options', () => {
    renderGrid([], ALL_CATEGORIES)
    const select = screen.getByRole('combobox', {
      name: /filter by category/i,
    })
    expect(select).toBeTruthy()
    expect(screen.getByRole('option', { name: 'All' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Handbag' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Flowers' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Flower Pots' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Keychains' })).toBeTruthy()
    expect(
      screen.getByRole('option', { name: 'Hair Accessories' })
    ).toBeTruthy()
  })

  it('filters products by search query', () => {
    renderGrid([makeProduct()], undefined, { search: 'Rose' })
    expect(screen.getByDisplayValue('Rose')).toBeTruthy()
  })

  it('filters products by category', () => {
    renderGrid([makeProduct({ category: 'Handbag' })], ['Flowers', 'Handbag'], {
      selectedCategory: 'Handbag',
    })
    const select = screen.getByRole('combobox', {
      name: /filter by category/i,
    })
    expect(select).toHaveValue('Handbag')
  })

  it('shows contextual empty message when search yields no results', () => {
    renderGrid([], undefined, { search: 'xyz-no-match' })
    expect(
      screen.getByText(/Try adjusting your search or category filter/i)
    ).toBeTruthy()
  })

  it('shows the product count and sets up IntersectionObserver when more products are available', () => {
    renderGrid([makeProduct()], ['Flowers'], {
      search: 'rose',
      selectedCategory: 'Flowers',
      hasNextPage: true,
      batchSize: 20,
    })

    expect(screen.getByText('Showing 1 product so far')).toBeTruthy()
    expect(mockIntersectionObserver).toHaveBeenCalled()
  })

  it('loads another batch of products from the API via infinite scroll', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).startsWith('/api/products')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              products: [
                toGridItem(makeProduct({ id: '2', name: 'Loaded Product' })),
              ],
              hasMore: false,
            },
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          rates: { INR: 83.12, USD: 1, EUR: 0.92, GBP: 0.79 },
        }),
      } as Response
    })

    renderGrid([makeProduct()], ['Flowers'], {
      search: 'rose',
      selectedCategory: 'Flowers',
      hasNextPage: true,
      batchSize: 20,
    })

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Loaded Product')).toBeTruthy()
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/products?q=rose&category=Flowers&limit=20&offset=1',
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
    expect(screen.getByText("You've seen all products.")).toBeTruthy()
  })
})
