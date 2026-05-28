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
  drizzleDb: {
    select: mockSelect,
  },
}))

vi.mock('@/lib/search', () => ({
  searchProductIdsCached: mockSearchProductIdsCached,
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
}))

import { searchCatalog } from '@/lib/search-discovery'

function queueSelectResults(results: unknown[]) {
  let index = 0

  mockSelect.mockImplementation(() => {
    if (index >= results.length) {
      throw new Error('Unexpected select call')
    }
    const value = results[index++]
    const whereResult = {
      groupBy: vi.fn(async () => value),
      limit: vi.fn(async () => value),
      then: (resolve: (value: unknown) => unknown) => resolve(value),
    }

    return {
      from: vi.fn(() => ({
        where: vi.fn(() => whereResult),
      })),
    }
  })
}

describe('search-discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindBestsellers.mockResolvedValue([])
    mockFindMinimalByIds.mockResolvedValue([])
    mockSearchProductIdsCached.mockResolvedValue(null)
  })

  it('uses DB fallback and marks fallbackUsed=true when search index is unavailable', async () => {
    mockFindAllMinimal.mockResolvedValue([
      {
        id: 'p1',
        name: 'Rose Basket',
        description: 'desc',
        category: 'Flowers',
        image: '/rose.jpg',
        price: 120,
        stock: 5,
        soldCount: 20,
      },
    ])

    queueSelectResults([
      [{ id: 'p1', createdAt: new Date('2025-01-01T00:00:00.000Z') }],
      [{ productId: 'p1', rating: 4.5 }],
      [{ productId: 'p1', variantCount: 2 }],
    ])

    const result = await searchCatalog({
      q: 'rose',
      sort: 'relevance',
      variant: 'all',
      limit: 10,
      offset: 0,
    })

    expect(result.fallbackUsed).toBe(true)
    expect(result.total).toBe(1)
    expect(result.results[0]?.id).toBe('p1')
  })

  it('aggregates category/stock/rating/variant facets from matched catalog set', async () => {
    mockFindAllMinimal.mockResolvedValue([
      {
        id: 'p1',
        name: 'Rose Basket',
        description: 'desc',
        category: 'Flowers',
        image: '/rose.jpg',
        price: 120,
        stock: 5,
        soldCount: 20,
      },
      {
        id: 'p2',
        name: 'Mini Bag',
        description: 'desc',
        category: 'Bags',
        image: '/bag.jpg',
        price: 80,
        stock: 0,
        soldCount: 5,
      },
    ])

    queueSelectResults([
      [
        { id: 'p1', createdAt: new Date('2025-01-01T00:00:00.000Z') },
        { id: 'p2', createdAt: new Date('2025-01-02T00:00:00.000Z') },
      ],
      [
        { productId: 'p1', rating: 4.8 },
        { productId: 'p2', rating: 2.4 },
      ],
      [
        { productId: 'p1', variantCount: 2 },
        { productId: 'p2', variantCount: 1 },
      ],
    ])

    const result = await searchCatalog({
      q: 'bag',
      sort: 'relevance',
      variant: 'all',
      limit: 10,
      offset: 0,
    })

    expect(result.facets.categories).toEqual(
      expect.arrayContaining([
        { value: 'Bags', count: 1 },
        { value: 'Flowers', count: 1 },
      ])
    )
    expect(result.facets.stock).toEqual({ inStock: 1, outOfStock: 1 })
    expect(result.facets.ratings).toEqual({ gte4: 1, gte3: 1, lt3: 1 })
    expect(result.facets.variants).toEqual({ single: 1, multiple: 1 })
  })
})
