import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFindAbandonedCartCandidates,
  mockGetFeatureFlags,
  mockLogBusinessEvent,
} = vi.hoisted(() => ({
  mockFindAbandonedCartCandidates: vi.fn(),
  mockGetFeatureFlags: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/edge-config', () => ({ getFeatureFlags: mockGetFeatureFlags }))
vi.mock('@/lib/logger', () => ({ logBusinessEvent: mockLogBusinessEvent }))
vi.mock('@/features/cart/services/abandoned-cart-service', () => ({
  findAbandonedCartCandidates: mockFindAbandonedCartCandidates,
}))

import { scanAbandonedCartsFunction } from '@/features/cart/inngest/abandoned-cart'

type FunctionInternals = {
  fn: (context: {
    step: {
      run: (id: string, handler: () => unknown) => Promise<unknown>
      sendEvent: (id: string, events: unknown[]) => Promise<void>
    }
  }) => Promise<unknown>
}

const sent: unknown[][] = []
const run = () =>
  (scanAbandonedCartsFunction as unknown as FunctionInternals).fn({
    step: {
      run: async (_id, handler) => handler(),
      sendEvent: async (_id, events) => {
        sent.push(events)
      },
    },
  })

describe('scanAbandonedCartsFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sent.length = 0
    mockGetFeatureFlags.mockResolvedValue({ enableAbandonedCartScanJob: true })
  })

  it('skips by default without querying cart candidates', async () => {
    mockGetFeatureFlags.mockResolvedValue({})

    await expect(run()).resolves.toEqual({ skipped: true, reason: 'disabled' })

    expect(mockFindAbandonedCartCandidates).not.toHaveBeenCalled()
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'cron_abandoned_cart_skipped' })
    )
  })

  it('continues to queue eligible cart reminders when enabled', async () => {
    mockFindAbandonedCartCandidates.mockResolvedValue([])

    await expect(run()).resolves.toEqual({ queued: 0 })

    expect(mockFindAbandonedCartCandidates).toHaveBeenCalledOnce()
    expect(sent).toEqual([])
  })
})
