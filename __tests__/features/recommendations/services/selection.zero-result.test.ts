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

import { getZeroResultRail } from '@/features/recommendations/services/selection'

const bestseller = (id: string, category = 'Kitchen') => ({
  id,
  name: `Product ${id}`,
  description: 'A product',
  image: `/${id}.jpg`,
  images: [],
  category,
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

describe('getZeroResultRail', () => {
  it('offers products instead of a dead end (Story 4, scenario 1)', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getZeroResultRail()

    expect(result.products.map((p) => p.id)).toEqual(['bbbbbbb'])
  })

  it('respects an active category filter (Story 4, scenario 2)', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb', 'Decor')])

    await getZeroResultRail({ category: 'Decor' })

    expect(findBestsellers).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Decor' })
    )
  })

  it('searches the whole catalog when no category filter is active', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    await getZeroResultRail()

    expect(findBestsellers).toHaveBeenCalledWith(
      expect.not.objectContaining({ category: expect.anything() })
    )
  })

  it('shows bestsellers when no recommendation data exists (Story 4, scenario 3)', async () => {
    selectRows.mockResolvedValue([])
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getZeroResultRail()

    expect(result.fallback).toBe(true)
  })

  it('reports the zero-result surface for event attribution', async () => {
    findBestsellers.mockResolvedValue([bestseller('bbbbbbb')])

    const result = await getZeroResultRail()

    expect(result.surface).toBe('zero_result')
  })
})
