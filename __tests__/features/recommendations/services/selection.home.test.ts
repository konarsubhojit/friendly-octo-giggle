import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { getHomeRail } from '@/features/recommendations/services/selection'

const candidateRow = (id: string) => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  category: 'Kitchen',
  price: 499,
  stock: 5,
  reservedStock: 0,
})

const bestseller = (id: string) => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  images: [],
  category: 'Kitchen',
  soldCount: 3,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [
    {
      id: `${id}v`,
      productId: id,
      sku: null,
      price: 499,
      stock: 4,
      reservedStock: 0,
      image: null,
      images: [],
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
  getCachedData.mockImplementation(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  )
  findBestsellers.mockResolvedValue([])
  selectRows.mockResolvedValue([])
})

describe('getHomeRail', () => {
  it('reflects the shopper own anchors (Story 3, scenario 1)', async () => {
    selectRows
      .mockResolvedValueOnce([{ recommendedProductId: 'ccccccc', score: 7 }])
      .mockResolvedValueOnce([candidateRow('ccccccc')])

    const result = await getHomeRail(['aaaaaaa'])

    expect(result.fallback).toBe(false)
    expect(result.products.map((p) => p.id)).toEqual(['ccccccc'])
  })

  it('unions recently-viewed seeds with history anchors (FR-001a)', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'ddddddd', score: 6 },
        { recommendedProductId: 'eeeeeee', score: 2 },
      ])
      .mockResolvedValueOnce([candidateRow('ddddddd'), candidateRow('eeeeeee')])

    const result = await getHomeRail(['aaaaaaa', 'bbbbbbb', 'ccccccc'])

    expect(result.products.map((p) => p.id)).toEqual(['ddddddd', 'eeeeeee'])
  })

  it('gives two shoppers with different histories different rails (Story 3, scenario 3; SC-004)', async () => {
    selectRows
      .mockResolvedValueOnce([{ recommendedProductId: 'ccccccc', score: 7 }])
      .mockResolvedValueOnce([candidateRow('ccccccc')])
    const first = await getHomeRail(['aaaaaaa'])

    selectRows
      .mockResolvedValueOnce([{ recommendedProductId: 'ddddddd', score: 7 }])
      .mockResolvedValueOnce([candidateRow('ddddddd')])
    const second = await getHomeRail(['bbbbbbb'])

    expect(first.products.map((p) => p.id)).not.toEqual(
      second.products.map((p) => p.id)
    )
  })

  it('falls back to bestsellers for a shopper with no history (Story 3, scenario 4)', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getHomeRail([])

    expect(result.fallback).toBe(true)
    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })

  it('does not recommend a product the shopper already owns or has seen', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'aaaaaaa', score: 9 },
        { recommendedProductId: 'ccccccc', score: 4 },
      ])
      .mockResolvedValueOnce([candidateRow('aaaaaaa'), candidateRow('ccccccc')])

    const result = await getHomeRail(['aaaaaaa'])

    expect(result.products.map((p) => p.id)).toEqual(['ccccccc'])
  })

  it('deduplicates repeated anchors before reading scores', async () => {
    selectRows
      .mockResolvedValueOnce([{ recommendedProductId: 'ccccccc', score: 7 }])
      .mockResolvedValueOnce([candidateRow('ccccccc')])

    const result = await getHomeRail(['aaaaaaa', 'aaaaaaa', 'aaaaaaa'])

    expect(result.products.map((p) => p.id)).toEqual(['ccccccc'])
  })
})
