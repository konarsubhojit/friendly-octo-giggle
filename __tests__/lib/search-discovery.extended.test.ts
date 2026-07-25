import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFindAllMinimal,
  mockFindMinimalByIds,
  mockFindBestsellers,
  mockSearchProductIdsCached,
  mockSelect,
  mockLogBusinessEvent,
} = vi.hoisted(() => ({
  mockFindAllMinimal: vi.fn(),
  mockFindMinimalByIds: vi.fn(),
  mockFindBestsellers: vi.fn(),
  mockSearchProductIdsCached: vi.fn(),
  mockSelect: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findAllMinimal: mockFindAllMinimal,
      findMinimalByIds: mockFindMinimalByIds,
      findBestsellers: mockFindBestsellers,
    },
  },
  drizzleDb: { select: mockSelect },
}))

vi.mock('@/lib/search', () => ({
  searchProductIdsCached: mockSearchProductIdsCached,
}))

vi.mock('@/lib/logger', () => ({ logBusinessEvent: mockLogBusinessEvent }))

import {
  searchCatalog,
  suggestSearchTerms,
  type SearchSort,
} from '@/lib/search-discovery'

function queueSelectResults(results: unknown[]) {
  let index = 0
  mockSelect.mockImplementation(() => {
    const value = index < results.length ? results[index++] : []
    const whereResult = {
      groupBy: vi.fn(async () => value),
      limit: vi.fn(async () => value),
      then: (resolve: (value: unknown) => unknown) => resolve(value),
    }
    return { from: vi.fn(() => ({ where: vi.fn(() => whereResult) })) }
  })
}

interface RowOverrides {
  id: string
  name?: string
  category?: string
  price?: number
  stock?: number
  soldCount?: number
}

const row = (overrides: RowOverrides) => ({
  name: `Product ${overrides.id}`,
  description: 'desc',
  category: 'Flowers',
  image: '/img.jpg',
  price: 100,
  stock: 5,
  soldCount: 10,
  ...overrides,
})

const catalogRows = [
  row({ id: 'p1', name: 'Alpha', price: 50, stock: 0, soldCount: 5 }),
  row({
    id: 'p2',
    name: 'Beta',
    category: 'Bags',
    price: 150,
    stock: 3,
    soldCount: 20,
  }),
  row({
    id: 'p3',
    name: 'Gamma',
    category: 'Bags',
    price: 100,
    stock: 8,
    soldCount: 20,
  }),
]

const catalogSelects = [
  [
    { id: 'p1', createdAt: new Date('2025-01-01T00:00:00.000Z') },
    { id: 'p2', createdAt: new Date('2025-01-03T00:00:00.000Z') },
    { id: 'p3', createdAt: new Date('2025-01-02T00:00:00.000Z') },
  ],
  [
    { productId: 'p1', rating: 4.5 },
    { productId: 'p2', rating: 3.2 },
    { productId: 'p3', rating: 2.1 },
  ],
  [
    { productId: 'p1', variantCount: 1 },
    { productId: 'p2', variantCount: 3 },
  ],
]

const baseOptions = {
  q: 'thing',
  sort: 'relevance' as SearchSort,
  variant: 'all' as const,
  limit: 10,
  offset: 0,
}

const runCatalog = (
  overrides: Partial<typeof baseOptions> & Record<string, unknown> = {}
) => {
  mockFindAllMinimal.mockResolvedValue(catalogRows)
  queueSelectResults(catalogSelects)
  return searchCatalog({ ...baseOptions, ...overrides })
}

describe('search-discovery (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindBestsellers.mockResolvedValue([])
    mockFindMinimalByIds.mockResolvedValue([])
    mockSearchProductIdsCached.mockResolvedValue(null)
  })

  it('uses the search index ordering when relevance ids are returned', async () => {
    mockSearchProductIdsCached.mockResolvedValue(['p3', 'p1'])
    mockFindMinimalByIds.mockResolvedValue([
      row({ id: 'p1', price: 50 }),
      row({ id: 'p3', price: 100 }),
    ])
    queueSelectResults([
      [
        { id: 'p1', createdAt: new Date('2025-01-01T00:00:00.000Z') },
        { id: 'p3', createdAt: new Date('2025-01-02T00:00:00.000Z') },
      ],
      [],
      [],
    ])

    const result = await searchCatalog({ ...baseOptions, category: ' Bags ' })

    expect(mockSearchProductIdsCached).toHaveBeenCalledWith(
      'thing',
      expect.objectContaining({ category: 'Bags' })
    )
    expect(result.fallbackUsed).toBe(false)
    expect(result.results.map((product) => product.id)).toEqual(['p3', 'p1'])
    expect(result.results[0]?.rating).toBe(0)
  })

  it('falls back to a zero createdAt when the product row is missing', async () => {
    mockSearchProductIdsCached.mockResolvedValue(['p9'])
    mockFindMinimalByIds.mockResolvedValue([row({ id: 'p9' })])
    queueSelectResults([[], [], []])

    const result = await searchCatalog(baseOptions)

    expect(result.results[0]?.createdAt).toBe(new Date(0).toISOString())
  })

  it('skips the search index when the query is blank', async () => {
    await runCatalog({ q: '   ' })
    expect(mockSearchProductIdsCached).not.toHaveBeenCalled()
  })

  it('skips the search index for non-relevance sorts', async () => {
    await runCatalog({ sort: 'newest' })
    expect(mockSearchProductIdsCached).not.toHaveBeenCalled()
  })

  it('filters out products below the minimum price', async () => {
    const result = await runCatalog({ minPrice: 100 })
    expect(result.results.map((product) => product.id)).toEqual(['p2', 'p3'])
  })

  it('filters out products above the maximum price', async () => {
    const result = await runCatalog({ maxPrice: 100 })
    expect(result.results.map((product) => product.id)).toEqual(['p3', 'p1'])
  })

  it('ignores non-finite price bounds', async () => {
    const result = await runCatalog({
      minPrice: Number.NaN,
      maxPrice: Number.NaN,
    })
    expect(result.total).toBe(3)
  })

  it('filters out-of-stock products when inStock is requested', async () => {
    const result = await runCatalog({ inStock: true })
    expect(result.results.map((product) => product.id)).toEqual(['p2', 'p3'])
  })

  it('filters by minimum rating', async () => {
    const result = await runCatalog({ minRating: 4 })
    expect(result.results.map((product) => product.id)).toEqual(['p1'])
  })

  it('ignores a non-finite minimum rating', async () => {
    const result = await runCatalog({ minRating: Number.NaN })
    expect(result.total).toBe(3)
  })

  it('filters single-variant products', async () => {
    const result = await runCatalog({ variant: 'single' })
    expect(result.results.map((product) => product.id)).toEqual(['p3', 'p1'])
  })

  it('filters multi-variant products', async () => {
    const result = await runCatalog({ variant: 'multiple' })
    expect(result.results.map((product) => product.id)).toEqual(['p2'])
  })

  it.each([
    ['price_asc', ['p1', 'p3', 'p2']],
    ['price_desc', ['p2', 'p3', 'p1']],
    ['newest', ['p2', 'p3', 'p1']],
    ['best_selling', ['p2', 'p3', 'p1']],
    ['top_rated', ['p1', 'p2', 'p3']],
  ] as Array<[SearchSort, string[]]>)('sorts by %s', async (sort, expected) => {
    const result = await runCatalog({ sort })
    expect(result.results.map((product) => product.id)).toEqual(expected)
  })

  it('breaks relevance ties using sold count and recency', async () => {
    const result = await runCatalog()
    expect(result.results.map((product) => product.id)).toEqual([
      'p2',
      'p3',
      'p1',
    ])
  })

  it('paginates the sorted results', async () => {
    const result = await runCatalog({ sort: 'price_asc', limit: 1, offset: 1 })
    expect(result.results.map((product) => product.id)).toEqual(['p3'])
    expect(result.total).toBe(3)
  })

  it('returns suggestions, trending products, and logs zero-result searches', async () => {
    mockFindAllMinimal.mockResolvedValue([])
    mockFindBestsellers.mockResolvedValue([
      { id: 'b1', name: 'Bestseller', category: 'Flowers', price: 10 },
    ])
    queueSelectResults([[], [], []])

    const result = await searchCatalog({ ...baseOptions, q: 'crochet bags' })

    expect(result.total).toBe(0)
    expect(result.suggestions).toContain('crochet bag')
    expect(result.trending).toEqual([
      { id: 'b1', name: 'Bestseller', category: 'Flowers' },
    ])
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'search_zero_results' })
    )
  })

  it('falls back to popular searches when nothing matches the query prefix', async () => {
    mockFindAllMinimal.mockResolvedValue([])
    queueSelectResults([[], [], []])

    const result = await searchCatalog({ ...baseOptions, q: 'zzzzzzz' })

    expect(result.suggestions).toEqual([
      'flower bouquet',
      'crochet bag',
      'keychain',
    ])
  })

  it('omits suggestions when the query is empty', async () => {
    mockFindAllMinimal.mockResolvedValue([])
    queueSelectResults([[], [], []])

    const result = await searchCatalog({ ...baseOptions, q: '  ' })

    expect(result.suggestions).toEqual([])
    expect(mockLogBusinessEvent).not.toHaveBeenCalled()
  })

  it('skips rating lookups when there are no candidates', async () => {
    mockFindAllMinimal.mockResolvedValue([])
    queueSelectResults([[]])

    const result = await searchCatalog(baseOptions)

    expect(result.results).toEqual([])
    expect(result.facets.price).toEqual({ min: 0, max: 0 })
  })
})

describe('suggestSearchTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchProductIdsCached.mockResolvedValue(null)
    mockFindAllMinimal.mockResolvedValue([])
    mockFindMinimalByIds.mockResolvedValue([])
  })

  it('returns defaults for a blank query', async () => {
    const result = await suggestSearchTerms('   ')
    expect(result).toEqual({
      query: '',
      products: [],
      categories: [],
      popular: ['flower bouquet', 'crochet bag', 'keychain', 'hair accessories'],
    })
    expect(mockSearchProductIdsCached).not.toHaveBeenCalled()
  })

  it('falls back to the database when the search index is unavailable', async () => {
    mockFindAllMinimal.mockResolvedValue([row({ id: 'p1', name: 'Alpha' })])
    queueSelectResults([[{ name: 'Flowers' }, { name: 'Flowers' }]])

    const result = await suggestSearchTerms('alp', 3)

    expect(mockFindAllMinimal).toHaveBeenCalledWith({
      search: 'alp',
      limit: 3,
      offset: 0,
    })
    expect(result.products).toEqual([
      { id: 'p1', label: 'Alpha', category: 'Flowers' },
    ])
    expect(result.categories).toEqual(['Flowers'])
  })

  it('uses the search index ids when available', async () => {
    mockSearchProductIdsCached.mockResolvedValue(['p1', 'p2'])
    mockFindMinimalByIds.mockResolvedValue([row({ id: 'p1', name: 'Alpha' })])
    queueSelectResults([[]])

    const result = await suggestSearchTerms('alpha')

    expect(mockFindMinimalByIds).toHaveBeenCalledWith(['p1', 'p2'])
    expect(result.query).toBe('alpha')
    expect(result.categories).toEqual([])
  })
})
