import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted so the `vi.mock` factories below — which Vitest lifts to the top of
// the module — can close over them without a temporal dead zone error.
const { getCachedData, findBestsellers, selectRows } = vi.hoisted(() => ({
  getCachedData: vi.fn(),
  findBestsellers: vi.fn(),
  selectRows: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({ getCachedData }))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))
vi.mock('@/lib/db-queries', () => ({ db: { products: { findBestsellers } } }))
vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: (...args: unknown[]) => selectRows(...args),
        }),
        where: () => ({
          orderBy: () => ({
            limit: (...args: unknown[]) => selectRows(...args),
          }),
        }),
      }),
    }),
  },
  primaryDrizzleDb: {},
}))

import {
  getProductRail,
  isEligibleCandidate,
  resolveBestsellerFallback,
  toRecommendationItem,
} from '@/features/recommendations/services/selection'

const candidate = (id: string, sellableStock = 5) => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  category: 'Kitchen',
  price: 499,
  sellableStock,
})

/** A variant row as `db.products.findBestsellers` returns it. */
const bestseller = (id: string, stock = 4, reservedStock = 0) => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  images: [],
  category: 'Kitchen',
  soldCount: 42,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [
    {
      id: `${id}v`,
      productId: id,
      sku: null,
      price: 499,
      stock,
      reservedStock,
      image: null,
      images: [],
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
})

/** Rows as the candidate join returns them (one row per variant). */
const candidateRow = (id: string, stock = 5, reservedStock = 0) => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  category: 'Kitchen',
  price: 499,
  stock,
  reservedStock,
})

beforeEach(() => {
  vi.clearAllMocks()
  // Default: the cache is a pass-through to the fetcher.
  getCachedData.mockImplementation(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  )
  findBestsellers.mockResolvedValue([])
  selectRows.mockResolvedValue([])
})

describe('isEligibleCandidate', () => {
  it('excludes a candidate with no sellable stock', () => {
    expect(isEligibleCandidate(candidate('aaaaaaa', 0), {})).toBe(false)
  })

  it('excludes a candidate whose stock is entirely reserved', () => {
    expect(isEligibleCandidate(candidate('aaaaaaa', 0), {})).toBe(false)
  })

  it('excludes the anchor product so a rail never recommends the page it is on', () => {
    expect(
      isEligibleCandidate(candidate('aaaaaaa'), { anchorProductId: 'aaaaaaa' })
    ).toBe(false)
  })

  it('excludes a caller-supplied product, which is how cart contents are dropped', () => {
    expect(
      isEligibleCandidate(candidate('aaaaaaa'), {
        excludeProductIds: new Set(['aaaaaaa']),
      })
    ).toBe(false)
  })

  it('admits an in-stock candidate that is neither the anchor nor excluded', () => {
    expect(
      isEligibleCandidate(candidate('bbbbbbb'), {
        anchorProductId: 'aaaaaaa',
        excludeProductIds: new Set(['ccccccc']),
      })
    ).toBe(true)
  })
})

describe('toRecommendationItem', () => {
  it('collapses stock to a boolean and drops the magnitude', () => {
    const item = toRecommendationItem(candidate('aaaaaaa', 97))

    expect(item.inStock).toBe(true)
    expect(item).not.toHaveProperty('stock')
    expect(item).not.toHaveProperty('sellableStock')
  })

  it('never carries a sales-volume count', () => {
    expect(toRecommendationItem(candidate('aaaaaaa'))).not.toHaveProperty(
      'soldCount'
    )
  })

  it('preserves the fields a rail actually renders', () => {
    expect(toRecommendationItem(candidate('aaaaaaa'))).toEqual({
      id: 'aaaaaaa',
      name: 'Product aaaaaaa',
      description: 'A product',
      image: '/aaaaaaa.jpg',
      category: 'Kitchen',
      price: 499,
      inStock: true,
    })
  })
})

describe('resolveBestsellerFallback', () => {
  it('strips stock and sold counts from the fallback branch too', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const [item] = await resolveBestsellerFallback(8, {})

    expect(item).not.toHaveProperty('stock')
    expect(item).not.toHaveProperty('soldCount')
    expect(item).not.toHaveProperty('variants')
    expect(item.inStock).toBe(true)
  })

  it('scopes to the anchor category when one is known', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    await resolveBestsellerFallback(8, { category: 'Kitchen' })

    expect(findBestsellers).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Kitchen' })
    )
  })

  it('widens to the whole catalog when the category yields nothing', async () => {
    findBestsellers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([bestseller('bbbbbbb')])

    const items = await resolveBestsellerFallback(8, { category: 'Empty' })

    expect(items).toHaveLength(1)
    expect(findBestsellers).toHaveBeenCalledTimes(2)
  })

  it('excludes a product whose stock is fully reserved', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb', 3, 3)])

    expect(await resolveBestsellerFallback(8, {})).toEqual([])
  })

  it('excludes the anchor from the fallback branch', async () => {
    findBestsellers.mockResolvedValue([
      bestseller('aaaaaaa'),
      bestseller('bbbbbbb'),
    ])

    const items = await resolveBestsellerFallback(8, {
      anchorProductId: 'aaaaaaa',
    })

    expect(items.map((i) => i.id)).toEqual(['bbbbbbb'])
  })

  it('truncates to the requested rail size', async () => {
    findBestsellers.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => bestseller(`p${i}`))
    )

    expect(await resolveBestsellerFallback(3, {})).toHaveLength(3)
  })
})

describe('rail resolution', () => {
  it('falls back to bestsellers when the anchor has no scored pairs', async () => {
    selectRows.mockResolvedValueOnce([])
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getProductRail('aaaaaaa')

    expect(result.fallback).toBe(true)
    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })

  it('falls back when every scored candidate is filtered out', async () => {
    selectRows
      .mockResolvedValueOnce([{ recommendedProductId: 'ccccccc', score: 9 }])
      // The candidate exists but has no sellable stock.
      .mockResolvedValueOnce([candidateRow('ccccccc', 2, 2)])
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getProductRail('aaaaaaa')

    expect(result.fallback).toBe(true)
    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })

  it('falls back when the cached score read throws, so a Redis outage degrades the rail instead of the page', async () => {
    getCachedData.mockRejectedValue(new Error('redis unavailable'))
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getProductRail('aaaaaaa')

    expect(result.fallback).toBe(true)
    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })

  it('returns scored candidates strongest first', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'ccccccc', score: 2 },
        { recommendedProductId: 'bbbbbbb', score: 9 },
      ])
      .mockResolvedValueOnce([candidateRow('bbbbbbb'), candidateRow('ccccccc')])

    const result = await getProductRail('aaaaaaa')

    expect(result.fallback).toBe(false)
    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb', 'ccccccc'])
  })

  it('never includes the anchor, even when it is scored against itself', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'aaaaaaa', score: 99 },
        { recommendedProductId: 'bbbbbbb', score: 5 },
      ])
      .mockResolvedValueOnce([candidateRow('aaaaaaa'), candidateRow('bbbbbbb')])

    const result = await getProductRail('aaaaaaa')

    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })

  it('emits no stock magnitude on the scored branch', async () => {
    selectRows
      .mockResolvedValueOnce([{ recommendedProductId: 'bbbbbbb', score: 5 }])
      .mockResolvedValueOnce([candidateRow('bbbbbbb', 77)])

    const [item] = (await getProductRail('aaaaaaa')).products

    expect(item).not.toHaveProperty('stock')
    expect(item.inStock).toBe(true)
  })

  it('honours the requested rail size', async () => {
    selectRows
      .mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, i) => ({
          recommendedProductId: `p${String(i).padStart(6, '0')}`,
          score: 10 - i,
        }))
      )
      .mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, i) =>
          candidateRow(`p${String(i).padStart(6, '0')}`)
        )
      )

    const result = await getProductRail('aaaaaaa', { limit: 3 })

    expect(result.products).toHaveLength(3)
  })
})
