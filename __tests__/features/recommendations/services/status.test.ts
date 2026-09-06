import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetCachedData, mockSelectFrom } = vi.hoisted(() => {
  const mockSelectFrom = vi.fn()
  return {
    mockGetCachedData: vi.fn(),
    mockSelectFrom,
  }
})

vi.mock('@/lib/redis', () => ({ getCachedData: mockGetCachedData }))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: () => ({ from: mockSelectFrom }),
  },
}))

vi.mock('@/lib/schema', () => ({
  productAffinityScores: {
    computedAt: 'computedAt',
    anchorProductId: 'anchorProductId',
  },
}))

vi.mock('@/lib/cache', () => ({
  CACHE_KEYS: { RECOMMENDATIONS_STATUS: 'recommendations:status' },
  CACHE_TTL: { RECOMMENDATIONS_STATUS: 3600 },
}))

vi.mock('drizzle-orm', () => ({
  countDistinct: vi.fn((x: unknown) => x),
  max: vi.fn((x: unknown) => x),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    {}
  ),
}))

import { getAffinityStatus } from '@/features/recommendations/services/status'

describe('getAffinityStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCachedData.mockImplementation(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
        fetcher()
    )
  })

  it('returns default values when the affinity table is empty', async () => {
    mockSelectFrom.mockResolvedValue([
      { lastComputedAt: null, pairCount: 0, anchorCount: 0 },
    ])

    const result = await getAffinityStatus()

    expect(result.lastComputedAt).toBeNull()
    expect(result.pairCount).toBe(0)
    expect(result.anchorCount).toBe(0)
    expect(result.windowDays).toBeGreaterThan(0)
    expect(result.minSupport).toBeGreaterThan(0)
  })

  it('summarises the most recent scoring run', async () => {
    mockSelectFrom.mockResolvedValue([
      {
        lastComputedAt: new Date('2026-02-01T00:00:00.000Z'),
        pairCount: 42,
        anchorCount: 7,
      },
    ])

    const result = await getAffinityStatus()

    expect(result.lastComputedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(result.pairCount).toBe(42)
    expect(result.anchorCount).toBe(7)
  })

  it('handles a missing row from the aggregate query', async () => {
    mockSelectFrom.mockResolvedValue([])

    const result = await getAffinityStatus()

    expect(result.lastComputedAt).toBeNull()
    expect(result.pairCount).toBe(0)
    expect(result.anchorCount).toBe(0)
  })
})
