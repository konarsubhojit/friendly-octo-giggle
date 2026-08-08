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

import { getCartRail } from '@/features/recommendations/services/selection'

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

beforeEach(() => {
  vi.clearAllMocks()
  getCachedData.mockImplementation(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  )
  findBestsellers.mockResolvedValue([])
  selectRows.mockResolvedValue([])
})

describe('getCartRail', () => {
  it('derives suggestions from all cart items combined (Story 2, scenario 1)', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'ccccccc', score: 4 },
        { recommendedProductId: 'ddddddd', score: 8 },
      ])
      .mockResolvedValueOnce([candidateRow('ccccccc'), candidateRow('ddddddd')])

    const result = await getCartRail(['aaaaaaa', 'bbbbbbb'])

    expect(result.fallback).toBe(false)
    expect(result.products.map((p) => p.id)).toEqual(['ddddddd', 'ccccccc'])
  })

  it('never re-suggests a product already in the cart (Story 2, scenario 2)', async () => {
    selectRows
      .mockResolvedValueOnce([
        { recommendedProductId: 'aaaaaaa', score: 9 },
        { recommendedProductId: 'ccccccc', score: 4 },
      ])
      .mockResolvedValueOnce([candidateRow('aaaaaaa'), candidateRow('ccccccc')])

    const result = await getCartRail(['aaaaaaa', 'bbbbbbb'])

    expect(result.products.map((p) => p.id)).toEqual(['ccccccc'])
  })

  it('renders no rail for an empty cart rather than falling back (Story 2, scenario 3)', async () => {
    const result = await getCartRail([])

    expect(result.products).toEqual([])
    expect(result.fallback).toBe(false)
    expect(findBestsellers).not.toHaveBeenCalled()
  })

  it('reports the cart surface so the event log can attribute the rail', async () => {
    const result = await getCartRail(['aaaaaaa'])

    expect(result.surface).toBe('cart')
  })

  it('falls back to bestsellers when a non-empty cart has no scored partners', async () => {
    selectRows.mockResolvedValueOnce([])
    findBestsellers.mockResolvedValue([])

    const result = await getCartRail(['aaaaaaa'])

    expect(result.fallback).toBe(true)
    expect(findBestsellers).toHaveBeenCalled()
  })
})
