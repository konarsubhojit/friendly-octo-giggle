// @vitest-environment jsdom
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import ProductGrid from '@/features/product/components/ProductGrid'
import type { ProductGridItem } from '@/features/product/components/ProductGrid'

const mockRouterPush = vi.fn()

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock('@/components/SearchBar', () => ({
  SearchBar: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (next: string) => void
  }) => (
    <input
      aria-label="Search products"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: vi.fn(() => []),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (v: number) => `₹${v}`,
    convertPrice: (v: number) => v,
    currency: 'INR' as const,
    currencySymbol: '₹',
  }),
}))

const makeItem = (
  overrides: Partial<ProductGridItem> = {}
): ProductGridItem => ({
  id: '1',
  name: 'Rose Bouquet',
  description: 'Lovely rose bouquet',
  image: '/img.jpg',
  category: 'Flowers',
  price: 100,
  stock: 10,
  soldCount: 3,
  ...overrides,
})

let intersectionCallback: IntersectionObserverCallback | null = null
const mockIntersectionObserver = vi.fn(function (
  this: unknown,
  callback: IntersectionObserverCallback
) {
  intersectionCallback = callback
  return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
})

const BASE_PRODUCTS: ProductGridItem[] = [makeItem()]
const BASE_CATEGORIES = ['Flowers']

const renderGrid = (
  props: Partial<React.ComponentProps<typeof ProductGrid>> = {}
) =>
  render(
    <ProductGrid
      products={BASE_PRODUCTS}
      categories={BASE_CATEGORIES}
      {...props}
    />
  )

const submitForm = () => {
  const applyButton = screen.getByRole('button', { name: 'Apply' })
  fireEvent.click(applyButton)
}

describe('ProductGrid (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    intersectionCallback = null
    vi.stubGlobal('IntersectionObserver', mockIntersectionObserver)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('filter form -> query params', () => {
    it('builds a query string from every filter control', async () => {
      renderGrid()

      fireEvent.change(screen.getByLabelText('Search products'), {
        target: { value: '  daisies  ' },
      })
      fireEvent.change(screen.getByLabelText('Filter by category'), {
        target: { value: 'Flowers' },
      })
      fireEvent.change(screen.getByLabelText('Sort products'), {
        target: { value: 'price_asc' },
      })
      fireEvent.change(screen.getByLabelText('Minimum price'), {
        target: { value: '10' },
      })
      fireEvent.change(screen.getByLabelText('Maximum price'), {
        target: { value: '90' },
      })
      fireEvent.click(screen.getByLabelText('In stock'))
      fireEvent.change(screen.getByLabelText('Minimum rating'), {
        target: { value: '4' },
      })
      fireEvent.change(screen.getByLabelText('Filter by variants'), {
        target: { value: 'multiple' },
      })

      submitForm()

      expect(mockRouterPush).toHaveBeenCalledWith(
        '/shop?q=daisies&category=Flowers&sort=price_asc&minPrice=10&maxPrice=90&inStock=true&minRating=4&variant=multiple#products',
        { scroll: false }
      )
    })

    it('swaps an inverted price range', () => {
      renderGrid()

      fireEvent.change(screen.getByLabelText('Minimum price'), {
        target: { value: '500' },
      })
      fireEvent.change(screen.getByLabelText('Maximum price'), {
        target: { value: '100' },
      })

      submitForm()

      const [href] = mockRouterPush.mock.calls[0]
      expect(href).toContain('minPrice=100')
      expect(href).toContain('maxPrice=500')
    })

    it('ignores non-numeric and negative filter values', () => {
      renderGrid()

      fireEvent.change(screen.getByLabelText('Minimum price'), {
        target: { value: 'abc' },
      })
      fireEvent.change(screen.getByLabelText('Maximum price'), {
        target: { value: 'xyz' },
      })

      submitForm()

      expect(mockRouterPush).toHaveBeenCalledWith('/shop#products', {
        scroll: false,
      })
    })

    it('omits defaults from the query string', () => {
      renderGrid()

      fireEvent.change(screen.getByLabelText('Filter by category'), {
        target: { value: 'All' },
      })
      fireEvent.change(screen.getByLabelText('Sort products'), {
        target: { value: 'relevance' },
      })

      submitForm()

      expect(mockRouterPush).toHaveBeenCalledWith('/shop#products', {
        scroll: false,
      })
    })

    it('shows a reset link only while filters are active', () => {
      const { rerender } = renderGrid()
      expect(screen.queryByRole('link', { name: 'Reset' })).toBeNull()

      rerender(
        <ProductGrid
          products={BASE_PRODUCTS}
          categories={BASE_CATEGORIES}
          search="rose"
        />
      )
      expect(screen.getByRole('link', { name: 'Reset' })).toBeTruthy()
    })

    it('syncs drafts back from props after a navigation', async () => {
      const { rerender } = renderGrid()

      rerender(
        <ProductGrid
          products={BASE_PRODUCTS}
          categories={BASE_CATEGORIES}
          search="tulip"
          selectedCategory="Flowers"
          selectedSort="newest"
          minPrice={5}
          maxPrice={50}
          inStock
          minRating={3}
          variant="single"
        />
      )

      await waitFor(() => {
        expect(
          (screen.getByLabelText('Search products') as HTMLInputElement).value
        ).toBe('tulip')
      })
      expect(
        (screen.getByLabelText('Minimum price') as HTMLInputElement).value
      ).toBe('5')
      expect(
        (screen.getByLabelText('Maximum price') as HTMLInputElement).value
      ).toBe('50')
      expect(
        (screen.getByLabelText('Minimum rating') as HTMLSelectElement).value
      ).toBe('3')
      expect(
        (screen.getByLabelText('Filter by variants') as HTMLSelectElement).value
      ).toBe('single')
      expect(
        (screen.getByLabelText('In stock') as HTMLInputElement).checked
      ).toBe(true)
    })

    it('clears numeric drafts when props omit them', async () => {
      const { rerender } = renderGrid({
        minPrice: 5,
        maxPrice: 50,
        minRating: 3,
      })

      rerender(
        <ProductGrid products={BASE_PRODUCTS} categories={BASE_CATEGORIES} />
      )

      await waitFor(() => {
        expect(
          (screen.getByLabelText('Minimum price') as HTMLInputElement).value
        ).toBe('')
      })
      expect(
        (screen.getByLabelText('Maximum price') as HTMLInputElement).value
      ).toBe('')
      expect(
        (screen.getByLabelText('Minimum rating') as HTMLSelectElement).value
      ).toBe('')
    })
  })

  describe('search click tracking', () => {
    it('uses sendBeacon when available', () => {
      const sendBeacon = vi.fn()
      Object.defineProperty(globalThis.navigator, 'sendBeacon', {
        value: sendBeacon,
        configurable: true,
      })

      renderGrid({ search: 'rose' })
      fireEvent.click(screen.getByRole('link', { name: 'Rose Bouquet' }))

      expect(sendBeacon).toHaveBeenCalledWith(
        '/api/search/click',
        expect.any(Blob)
      )
      expect(fetch).not.toHaveBeenCalled()

      Reflect.deleteProperty(globalThis.navigator, 'sendBeacon')
    })

    it('falls back to fetch when sendBeacon is unavailable', () => {
      Reflect.deleteProperty(globalThis.navigator, 'sendBeacon')
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response)

      renderGrid()
      fireEvent.click(screen.getByRole('link', { name: 'Rose Bouquet' }))

      expect(fetch).toHaveBeenCalledWith(
        '/api/search/click',
        expect.objectContaining({ method: 'POST', keepalive: true })
      )
    })
  })

  describe('infinite scroll', () => {
    /** Let the mount effects (which reset paging state) settle first. */
    const flushMountEffects = async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    }

    const triggerIntersection = async (isIntersecting = true) => {
      await flushMountEffects()
      await act(async () => {
        intersectionCallback?.(
          [{ isIntersecting } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })
    }

    it('sends every active filter to the products API', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { products: [], hasMore: false },
        }),
      } as Response)

      renderGrid({
        search: 'rose',
        selectedCategory: 'Flowers',
        selectedSort: 'newest',
        minPrice: 10,
        maxPrice: 90,
        inStock: true,
        minRating: 4,
        variant: 'single',
        hasNextPage: true,
        batchSize: 5,
      })

      await triggerIntersection()

      expect(fetch).toHaveBeenCalledWith(
        '/api/products?q=rose&category=Flowers&sort=newest&minPrice=10&maxPrice=90&inStock=true&minRating=4&variant=single&limit=5&offset=1',
        { method: 'GET', headers: { Accept: 'application/json' } }
      )
    })

    it('shows an error message when the API responds with a failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'boom' }),
      } as Response)

      renderGrid({ hasNextPage: true })
      await triggerIntersection()

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(
          'Could not load more products'
        )
      })
    })

    it('shows an error message when the request rejects', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('offline'))

      renderGrid({ hasNextPage: true })
      await triggerIntersection()

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy()
      })
    })

    it('does not fetch when the sentinel is not intersecting', async () => {
      renderGrid({ hasNextPage: true })
      await triggerIntersection(false)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('does not fetch when there is no next page', async () => {
      renderGrid({ hasNextPage: false })
      await triggerIntersection()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('deduplicates products already on the page', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            products: [BASE_PRODUCTS[0], makeItem({ id: '2', name: 'Lily' })],
            hasMore: false,
          },
        }),
      } as Response)

      renderGrid({ hasNextPage: true })
      await triggerIntersection()

      await waitFor(() => {
        expect(screen.getByText('Lily')).toBeTruthy()
      })
      expect(screen.getAllByText('Rose Bouquet')).toHaveLength(1)
    })
  })

  describe('empty state extras', () => {
    it('renders suggestions and navigates when one is picked', () => {
      renderGrid({
        products: [],
        search: 'rse',
        selectedCategory: 'Flowers',
        suggestions: ['rose'],
      })

      fireEvent.click(screen.getByRole('button', { name: 'rose' }))

      expect(mockRouterPush).toHaveBeenCalledWith(
        '/shop?q=rose&category=Flowers#products',
        { scroll: false }
      )
    })

    it('omits the category when browsing all categories', () => {
      renderGrid({ products: [], suggestions: ['rose'] })

      fireEvent.click(screen.getByRole('button', { name: 'rose' }))

      expect(mockRouterPush).toHaveBeenCalledWith('/shop?q=rose#products', {
        scroll: false,
      })
    })

    it('renders trending products', () => {
      renderGrid({
        products: [],
        trending: [{ id: '9', name: 'Trending Item', category: 'Flowers' }],
      })

      expect(screen.getByText('Trending products')).toBeTruthy()
      expect(
        screen.getByRole('link', { name: 'Trending Item' }).getAttribute('href')
      ).toBe('/products/9')
    })

    it('hides the suggestion panel when there is nothing to suggest', () => {
      renderGrid({ products: [] })
      expect(screen.queryByText('Did you mean')).toBeNull()
      expect(screen.queryByText('Trending products')).toBeNull()
    })
  })

  describe('search highlighting', () => {
    it('highlights matching text in product names', () => {
      const { container } = renderGrid({ search: 'rose' })
      const marks = container.querySelectorAll('mark')
      expect(marks.length).toBeGreaterThan(0)
      expect(marks[0].textContent?.toLowerCase()).toBe('rose')
    })

    it('escapes regex characters in the query', () => {
      const { container } = render(
        <ProductGrid
          products={[makeItem({ name: 'Rose (Red)' })]}
          search="(Red)"
        />
      )
      const marks = container.querySelectorAll('mark')
      expect(marks[0].textContent).toBe('(Red)')
    })

    it('does not highlight when the query is blank', () => {
      const { container } = renderGrid({ search: '   ' })
      expect(container.querySelectorAll('mark')).toHaveLength(0)
    })
  })
})
