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

import { getProductRail } from '@/features/recommendations/services/selection'

const candidateRow = (id: string, category = 'Kitchen') => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  category,
  price: 499,
  stock: 5,
  reservedStock: 0,
})

const bestseller = (id: string, category = 'Kitchen') => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  images: [],
  category,
  soldCount: 12,
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

describe('getProductRail', () => {
  it('orders partners by association strength (Story 1, scenario 1)', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'ddddddd', score: 1 },
        { recommendedProductId: 'bbbbbbb', score: 9 },
        { recommendedProductId: 'ccccccc', score: 5 },
      ])
      .mockResolvedValueOnce([
        candidateRow('bbbbbbb'),
        candidateRow('ccccccc'),
        candidateRow('ddddddd'),
      ])

    const result = await getProductRail('aaaaaaa')

    expect(result.products.map((p) => p.id)).toEqual([
      'bbbbbbb',
      'ccccccc',
      'ddddddd',
    ])
  })

  it('falls back to same-category bestsellers when the anchor has no rows (Story 1, scenario 2)', async () => {
    selectRows.mockResolvedValueOnce([])
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getProductRail('aaaaaaa', { category: 'Kitchen' })

    expect(result.fallback).toBe(true)
    expect(findBestsellers).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Kitchen' })
    )
    expect(result.products).not.toHaveLength(0)
  })

  it('excludes a soft-deleted candidate (Story 1, scenario 3)', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'bbbbbbb', score: 9 },
        { recommendedProductId: 'ccccccc', score: 5 },
      ])
      // The candidate query filters `deletedAt IS NULL`, so the soft-deleted
      // product simply never comes back.
      .mockResolvedValueOnce([candidateRow('ccccccc')])

    const result = await getProductRail('aaaaaaa')

    expect(result.products.map((p) => p.id)).toEqual(['ccccccc'])
  })

  it('excludes an out-of-stock candidate (Story 1, scenario 3)', async () => {
    selectRows
      .mockResolvedValueOnce([{ recommendedProductId: 'bbbbbbb', score: 9 }])
      .mockResolvedValueOnce([
        { ...candidateRow('bbbbbbb'), stock: 2, reservedStock: 2 },
      ])
    findBestsellers.mockResolvedValue([bestseller('ccccccc')])

    const result = await getProductRail('aaaaaaa')

    expect(result.products.map((p) => p.id)).not.toContain('bbbbbbb')
  })

  it('never includes the anchor on the scored branch (Story 1, scenario 4)', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'aaaaaaa', score: 99 },
        { recommendedProductId: 'bbbbbbb', score: 3 },
      ])
      .mockResolvedValueOnce([candidateRow('aaaaaaa'), candidateRow('bbbbbbb')])

    const result = await getProductRail('aaaaaaa')

    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })

  it('never includes the anchor on the fallback branch (Story 1, scenario 4)', async () => {
    selectRows.mockResolvedValueOnce([])
    findBestsellers.mockResolvedValue([
      bestseller('aaaaaaa'),
      bestseller('bbbbbbb'),
    ])

    const result = await getProductRail('aaaaaaa')

    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })
})
