import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  ),
  isRedisAvailable: vi.fn(() => false),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
  logCacheOperation: vi.fn(),
  Timer: class {
    end() {}
  },
}))

import { GET } from '@/app/api/exchange-rates/route'

function mockJsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as unknown as Response
}

describe('GET /api/exchange-rates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns 503 when EXCHANGE_RATE_API_KEY is not configured', async () => {
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Exchange rate API key not configured')
  })

  it('returns INR-normalised rates when the API reports INR as base', async () => {
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'test-key')
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockJsonResponse({
        result: 'success',
        base_code: 'INR',
        conversion_rates: { INR: 1, USD: 0.01193, EUR: 0.01098, GBP: 0.00943 },
      })
    )

    const res = await GET()
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.rates.INR).toBe(1)
    expect(data.rates.USD).toBeCloseTo(0.01193, 5)
    expect(data.rates.EUR).toBeCloseTo(0.01098, 5)
    expect(data.rates.GBP).toBeCloseTo(0.00943, 5)
  })

  it('correctly normalises rates when the API returns USD as base (sample response format)', async () => {
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'test-key')
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockJsonResponse({
        result: 'success',
        base_code: 'USD',
        conversion_rates: {
          USD: 1,
          INR: 91.8737,
          EUR: 0.8624,
          GBP: 0.7482,
        },
      })
    )

    const res = await GET()
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.rates.INR).toBe(1)
    expect(data.rates.USD).toBeCloseTo(1 / 91.8737, 5)
    expect(data.rates.EUR).toBeCloseTo(0.8624 / 91.8737, 5)
    expect(data.rates.GBP).toBeCloseTo(0.7482 / 91.8737, 5)
  })

  it('returns 502 when the external API responds with a non-OK HTTP status', async () => {
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'test-key')
    vi.mocked(global.fetch).mockResolvedValueOnce(mockJsonResponse({}, false))

    const res = await GET()
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it("returns 502 when the external API result field is not 'success'", async () => {
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'test-key')
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockJsonResponse({ result: 'error', 'error-type': 'invalid-key' })
    )

    const res = await GET()
    expect(res.status).toBe(502)
  })

  it('returns 500 when the fetch call throws a network error', async () => {
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'test-key')
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('passes the date-scoped cache key to getCachedData', async () => {
    const { getCachedData } = await import('@/lib/redis')
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'test-key')
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockJsonResponse({
        result: 'success',
        base_code: 'INR',
        conversion_rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 },
      })
    )

    await GET()

    const todayUtc = new Date().toISOString().slice(0, 10)
    expect(getCachedData).toHaveBeenCalledWith(
      `exchange-rates:${todayUtc}`,
      expect.any(Number),
      expect.any(Function),
      300
    )
  })

  it('does not include unsupported currencies in the response', async () => {
    vi.stubEnv('EXCHANGE_RATE_API_KEY', 'test-key')
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockJsonResponse({
        result: 'success',
        base_code: 'INR',
        conversion_rates: {
          INR: 1,
          USD: 0.012,
          EUR: 0.011,
          GBP: 0.0095,
          JPY: 1.88,
          AUD: 0.0187,
        },
      })
    )

    const res = await GET()
    const { data } = await res.json()
    expect(Object.keys(data.rates)).toEqual(
      expect.arrayContaining(['INR', 'USD', 'EUR', 'GBP'])
    )
    expect(data.rates).not.toHaveProperty('JPY')
    expect(data.rates).not.toHaveProperty('AUD')
  })
})
