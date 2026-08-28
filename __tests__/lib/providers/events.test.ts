import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

const importEvents = async () => import('@/lib/providers/events')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('provider lifecycle events', () => {
  it('logs unavailability at error with the fixed field set', async () => {
    const { logProviderUnavailable, PROVIDER_EVENTS } = await importEvents()

    logProviderUnavailable({
      capability: 'cache',
      provider: 'redis',
      reason: 'connection_refused',
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      {
        type: PROVIDER_EVENTS.unavailable,
        capability: 'cache',
        provider: 'redis',
        reason: 'connection_refused',
      },
      'Provider unavailable: cache/redis'
    )
  })

  it('logs a fallback at warn naming both providers', async () => {
    const { logProviderFallback, PROVIDER_EVENTS } = await importEvents()

    logProviderFallback({
      capability: 'storage',
      provider: 'r2',
      fallbackProvider: 'vercel',
    })

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PROVIDER_EVENTS.fallback,
        provider: 'r2',
        fallbackProvider: 'vercel',
      }),
      'Provider fallback: storage/r2 → vercel'
    )
  })

  it('logs degraded mode at warn with the impact', async () => {
    const { logProviderDegraded, PROVIDER_EVENTS } = await importEvents()

    logProviderDegraded({
      capability: 'cache',
      provider: 'upstash',
      impact: 'cache_bypass',
    })

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PROVIDER_EVENTS.degraded,
        impact: 'cache_bypass',
      }),
      'Provider degraded: cache/upstash (cache_bypass)'
    )
  })

  it('logs recovery at info', async () => {
    const { logProviderRecovered, PROVIDER_EVENTS } = await importEvents()

    logProviderRecovered({ capability: 'search', provider: 'upstash' })

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ type: PROVIDER_EVENTS.recovered }),
      'Provider recovered: search/upstash'
    )
  })

  it('exposes four distinct event names', async () => {
    const { PROVIDER_EVENTS } = await importEvents()

    expect(new Set(Object.values(PROVIDER_EVENTS)).size).toBe(4)
  })
})
