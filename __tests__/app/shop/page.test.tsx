// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindBestsellers = vi.fn()
const mockSearchCatalog = vi.fn()
const mockCategoryOrderBy = vi.fn()
const mockCategoryWhere = vi.fn(() => ({ orderBy: mockCategoryOrderBy }))
const mockCategoryFrom = vi.fn(() => ({ where: mockCategoryWhere }))
const mockCategorySelect = vi.fn(() => ({ from: mockCategoryFrom }))

vi.mock('next/image', () => ({
  default: ({
    alt = '',
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/layout/Footer', () => ({
  default: () => <div>Footer</div>,
}))

vi.mock('@/features/product/components/BestsellersScroller', () => ({
  BestsellersScroller: ({
    bestsellers,
  }: {
    bestsellers: Array<{ id: string; name: string }>
  }) => (
    <div>
      {bestsellers.map((p) => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/features/product/components/ProductGrid', () => ({
  __esModule: true,
  default: ({
    products,
    hasNextPage,
    batchSize,
    selectedSort,
  }: {
    products: Array<{ name: string }>
    hasNextPage: boolean
    batchSize: number
    selectedSort: string
  }) => (
    <div>
      <div>Grid count: {products.length}</div>
      <div>Grid next: {String(hasNextPage)}</div>
      <div>Grid batch: {batchSize}</div>
      <div>Grid sort: {selectedSort}</div>
      {products.map((product) => (
        <div key={product.name}>{product.name}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findBestsellers: mockFindBestsellers,
    },
  },
  drizzleDb: {
    select: mockCategorySelect,
  },
}))

vi.mock('@/lib/cache', () => ({
  cacheCategoriesList: vi.fn(async (fetcher: () => Promise<unknown>) =>
    fetcher()
  ),
  cacheProductsBestsellers: vi.fn(async (fetcher: () => Promise<unknown>) =>
    fetcher()
  ),
}))

vi.mock('@/lib/search-discovery', () => ({
  SEARCH_SORT_VALUES: [
    'relevance',
    'price_asc',
    'price_desc',
    'newest',
    'best_selling',
    'top_rated',
  ],
  SEARCH_VARIANT_VALUES: ['all', 'single', 'multiple'],
  searchCatalog: mockSearchCatalog,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

describe('app/shop/page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockFindBestsellers.mockResolvedValue([])
    mockCategoryOrderBy.mockResolvedValue([{ name: 'Flowers' }])
    mockSearchCatalog.mockResolvedValue({
      query: 'flowers',
      results: [
        {
          id: 'prod002',
          name: 'Lily Basket',
          description: 'desc',
          price: 12,
          stock: 2,
          soldCount: 4,
          category: 'Flowers',
          image: '/lily.jpg',
        },
        {
          id: 'prod001',
          name: 'Rose Bouquet',
          description: 'desc',
          price: 10,
          stock: 1,
          soldCount: 7,
          category: 'Flowers',
          image: '/rose.jpg',
        },
      ],
      total: 2,
      facets: {
        categories: [],
        price: { min: 10, max: 12 },
        stock: { inStock: 2, outOfStock: 0 },
        ratings: { gte4: 0, gte3: 0, lt3: 2 },
        variants: { single: 0, multiple: 2 },
      },
      sort: 'relevance',
      fallbackUsed: false,
      suggestions: [],
      trending: [],
    })
  })

  it('uses catalog search response for initial shop products and sort', async () => {
    const { default: ShopPage } = await import('@/app/[locale]/(public)/shop/page')
    const view = await ShopPage({
      searchParams: Promise.resolve({ q: 'flowers', sort: 'price_desc' }),
    })

    render(view)

    expect(mockSearchCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'flowers',
        sort: 'price_desc',
      })
    )
    expect(screen.getByText('Lily Basket')).toBeInTheDocument()
    expect(screen.getByText('Rose Bouquet')).toBeInTheDocument()
    expect(screen.getByText('Grid count: 2')).toBeInTheDocument()
    expect(screen.getByText('Grid batch: 20')).toBeInTheDocument()
    expect(screen.getByText('Grid sort: price_desc')).toBeInTheDocument()
  }, 15000)
})
