import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetFeatureFlags, mockLogBusinessEvent } = vi.hoisted(() => ({
  mockGetFeatureFlags: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/edge-config', () => ({ getFeatureFlags: mockGetFeatureFlags }))
vi.mock('@/lib/logger', () => ({ logBusinessEvent: mockLogBusinessEvent }))
vi.mock('@/features/recommendations/services/scoring', () => ({
  batchAnchors: vi.fn(() => []),
  collectPurchasePairs: vi.fn(),
  collectSharePairs: vi.fn(),
  collectWishlistPairs: vi.fn(),
  mergeSignals: vi.fn(() => []),
  resolveWindowStart: vi.fn(() => new Date('2026-01-01T00:00:00.000Z')),
  truncateByAnchor: vi.fn(() => new Map()),
  writeAffinityBatch: vi.fn(),
}))
vi.mock('@/lib/redis', () => ({ invalidateCache: vi.fn() }))

import { computeProductAffinityFunction } from '@/features/recommendations/inngest/affinity'

type FunctionInternals = {
  fn: (context: {
    event?: { data?: Record<string, unknown> }
    step: {
      run: (id: string, handler: () => unknown) => Promise<unknown>
      score: (id: string, score: unknown) => Promise<void>
    }
  }) => Promise<unknown>
}

const run = (event?: { data?: Record<string, unknown> }) =>
  (computeProductAffinityFunction as unknown as FunctionInternals).fn({
    event,
    step: {
      run: async (_id, handler) => handler(),
      score: async () => undefined,
    },
  })

describe('computeProductAffinityFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFeatureFlags.mockResolvedValue({ enableProductAffinityJob: true })
  })

  it('skips the cron path by default before loading scoring services', async () => {
    mockGetFeatureFlags.mockResolvedValue({})

    await expect(run()).resolves.toEqual({ skipped: true, reason: 'disabled' })

    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'cron_product_affinity_skipped' })
    )
  })

  it('runs explicit admin recomputes while the cron flag is disabled', async () => {
    mockGetFeatureFlags.mockResolvedValue({})

    await expect(run({ data: { triggeredBy: 'admin' } })).resolves.toEqual(
      expect.objectContaining({ computed: true })
    )

    expect(mockGetFeatureFlags).not.toHaveBeenCalled()
  })

  it('runs the cron recomputation when enabled', async () => {
    await expect(run()).resolves.toEqual(
      expect.objectContaining({ computed: true })
    )

    expect(mockGetFeatureFlags).toHaveBeenCalledOnce()
  })
})
