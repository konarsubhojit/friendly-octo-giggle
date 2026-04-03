import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindAllMinimal = vi.fn()
const mockFindBestsellers = vi.fn()
const mockFindMinimalByIds = vi.fn()
const mockSearchProductIdsCached = vi.fn()
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

vi.mock('@/components/sections/BestsellersScroller', () => ({
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
  }: {
    products: Array<{ name: string }>
    hasNextPage: boolean
    batchSize: number
  }) => (
    <div>
      <div>Grid count: {products.length}</div>
      <div>Grid next: {String(hasNextPage)}</div>
      <div>Grid batch: {batchSize}</div>
      {products.map((product) => (
        <div key={product.name}>{product.name}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findAllMinimal: mockFindAllMinimal,
      findBestsellers: mockFindBestsellers,
      findMinimalByIds: mockFindMinimalByIds,
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

vi.mock('@/lib/search', () => ({
  searchProductIdsCached: mockSearchProductIdsCached,
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
    mockSearchProductIdsCached.mockResolvedValue(null)
    mockFindAllMinimal.mockResolvedValue([])
  })

  it('uses cached Upstash ids for shop search before falling back to database search', async () => {
    mockSearchProductIdsCached.mockResolvedValue(['prod002', 'prod001'])
    mockFindMinimalByIds.mockResolvedValue([
      {
        id: 'prod001',
        name: 'Rose Bouquet',
        description: 'desc',
        price: 10,
        stock: 1,
        category: 'Flowers',
        image: '/rose.jpg',
      },
      {
        id: 'prod002',
        name: 'Lily Basket',
        description: 'desc',
        price: 12,
        stock: 2,
        category: 'Flowers',
        image: '/lily.jpg',
      },
    ])

    const { default: ShopPage } = await import('@/app/shop/page')
    const view = await ShopPage({
      searchParams: Promise.resolve({ q: 'flowers' }),
    })

    render(view)

    expect(mockSearchProductIdsCached).toHaveBeenCalledWith('flowers', {
      category: undefined,
      limit: 25,
    })
    expect(mockFindMinimalByIds).toHaveBeenCalledWith(
      ['prod002', 'prod001'],
      undefined
    )
    expect(mockFindAllMinimal).not.toHaveBeenCalled()
    expect(screen.getByText('Lily Basket')).toBeInTheDocument()
    expect(screen.getByText('Rose Bouquet')).toBeInTheDocument()
    expect(screen.getByText('Grid count: 2')).toBeInTheDocument()
    expect(screen.getByText('Grid batch: 20')).toBeInTheDocument()
  }, 15000)
})
