import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.hoisted(() => vi.fn())
const mockSlidingWindow = vi.hoisted(() => vi.fn(() => 'sliding-window'))
const mockGetRedisClient = vi.hoisted(() => vi.fn())
const mockRatelimitCtor = vi.hoisted(() => vi.fn())

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    constructor(config: unknown) {
      mockRatelimitCtor(config)
    }
    limit = mockLimit
    static slidingWindow = mockSlidingWindow
  }
  return { Ratelimit }
})

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
}))

const buildRequest = (pathname: string, headers: Record<string, string> = {}) =>
  ({
    nextUrl: { pathname },
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  }) as unknown as import('next/server').NextRequest

describe('rate-limit', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLimit.mockReset()
    mockSlidingWindow.mockClear()
    mockRatelimitCtor.mockClear()
    mockGetRedisClient.mockReset()
  })

  it('returns null when redis is unavailable', async () => {
    mockGetRedisClient.mockReturnValue(null)
    const { checkRateLimit } = await import('@/lib/rate-limit')

    const result = await checkRateLimit(buildRequest('/api/products'))
    expect(result).toBeNull()
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('uses the strict limiter for /api/auth paths', async () => {
    mockGetRedisClient.mockReturnValue({})
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1700000000,
    })

    const { checkRateLimit, STRICT_RATE_LIMIT_MAX_REQUESTS } = await import(
      '@/lib/rate-limit'
    )

    const result = await checkRateLimit(
      buildRequest('/api/auth/login', { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    )

    expect(result).toEqual({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1700000000,
    })
    expect(mockSlidingWindow).toHaveBeenCalledWith(
      STRICT_RATE_LIMIT_MAX_REQUESTS,
      '60 s'
    )
    expect(mockLimit).toHaveBeenCalledWith('1.2.3.4')
  })

  it('uses the general limiter for other paths and falls back to anonymous', async () => {
    mockGetRedisClient.mockReturnValue({})
    mockLimit.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: 1700000000,
    })

    const { checkRateLimit, GENERAL_RATE_LIMIT_MAX_REQUESTS } = await import(
      '@/lib/rate-limit'
    )

    const result = await checkRateLimit(buildRequest('/api/products'))

    expect(result?.success).toBe(false)
    expect(mockSlidingWindow).toHaveBeenCalledWith(
      GENERAL_RATE_LIMIT_MAX_REQUESTS,
      '60 s'
    )
    expect(mockLimit).toHaveBeenCalledWith('anonymous')
  })

  it('memoizes the limiter instances across calls', async () => {
    mockGetRedisClient.mockReturnValue({})
    mockLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 1,
    })

    const { checkRateLimit } = await import('@/lib/rate-limit')

    await checkRateLimit(buildRequest('/api/products'))
    await checkRateLimit(buildRequest('/api/products'))

    expect(mockRatelimitCtor).toHaveBeenCalledTimes(1)
  })

  it('returns null when the underlying limiter throws', async () => {
    mockGetRedisClient.mockReturnValue({})
    mockLimit.mockRejectedValue(new Error('redis down'))
    const { checkRateLimit } = await import('@/lib/rate-limit')

    const result = await checkRateLimit(buildRequest('/api/products'))
    expect(result).toBeNull()
  })
})
