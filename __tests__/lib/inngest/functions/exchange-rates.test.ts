import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetFeatureFlags, mockLogBusinessEvent } = vi.hoisted(() => ({
  mockGetFeatureFlags: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/edge-config', () => ({ getFeatureFlags: mockGetFeatureFlags }))
vi.mock('@/lib/logger', () => ({ logBusinessEvent: mockLogBusinessEvent }))

import { refreshExchangeRatesFunction } from '@/lib/inngest/functions/exchange-rates'

type FunctionInternals = {
  fn: (context: { step: unknown }) => Promise<unknown>
}

const run = () =>
  (refreshExchangeRatesFunction as unknown as FunctionInternals).fn({
    step: {},
  })

describe('refreshExchangeRatesFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mockGetFeatureFlags.mockResolvedValue({
      enableExchangeRateRefreshJob: true,
    })
  })

  it('skips by default without checking exchange-rate credentials', async () => {
    mockGetFeatureFlags.mockResolvedValue({})
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'configured')

    await expect(run()).resolves.toEqual({ skipped: true, reason: 'disabled' })

    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'cron_exchange_rates_skipped' })
    )
  })

  it('continues to its existing missing-credential fallback when enabled', async () => {
    await expect(run()).resolves.toEqual({
      refreshed: false,
      reason: 'api-key-missing',
    })
  })
})
