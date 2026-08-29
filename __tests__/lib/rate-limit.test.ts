import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.hoisted(() => vi.fn())

const setupMockLimiter = () => {
  class MockLimiter { limit = mockLimit }
  vi.doMock('@/lib/rate-limiter', () => ({
    createRateLimiter: vi.fn(() => new MockLimiter()),
    InMemoryRateLimiter: vi.fn(),
  }))
}

const setupNullLimiter = () => {
  vi.doMock('@/lib/rate-limiter', () => ({
    createRateLimiter: vi.fn(() => null),
    InMemoryRateLimiter: vi.fn(),
  }))
}

const buildRequest = (pathname: string, headers: Record<string, string> = {}) =>
  ({
    nextUrl: { pathname },
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  }) as unknown as import('next/server').NextRequest

describe('rate-limit', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLimit.mockReset()
  })

  it('returns null when provider returns no limiter', async () => {
    setupNullLimiter()
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const result = await checkRateLimit(buildRequest('/api/products'))
    expect(result).toBeNull()
  })

  it('uses the strict limiter for /api/auth paths', async () => {
    setupMockLimiter()
    mockLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 1700000000 })
    const { checkRateLimit } = await import('@/lib/rate-limit')

    const result = await checkRateLimit(
      buildRequest('/api/auth/login', { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    )
    expect(result).toEqual({ success: true, limit: 10, remaining: 9, reset: 1700000000 })
    expect(mockLimit).toHaveBeenCalledWith('ip:1.2.3.4')
  })

  it('uses the general limiter for other paths and falls back to anonymous', async () => {
    setupMockLimiter()
    mockLimit.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: 1700000000 })
    const { checkRateLimit } = await import('@/lib/rate-limit')

    const result = await checkRateLimit(buildRequest('/api/products'))
    expect(result?.success).toBe(false)
    expect(mockLimit).toHaveBeenCalledWith('ip:anonymous')
  })

  it('uses the strict limiter for POST /api/checkout (exact match)', async () => {
    setupMockLimiter()
    mockLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 1700000000 })
    const { checkRateLimit } = await import('@/lib/rate-limit')
    await checkRateLimit(buildRequest('/api/checkout'))
    expect(mockLimit).toHaveBeenCalled()
  })

  it('uses the general limiter for GET /api/checkout/{id} (status poll)', async () => {
    setupMockLimiter()
    mockLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 1700000000 })
    const { checkRateLimit } = await import('@/lib/rate-limit')
    await checkRateLimit(buildRequest('/api/checkout/abc1234'))
    expect(mockLimit).toHaveBeenCalled()
  })

  it('scopes identifier to user when userId is provided', async () => {
    setupMockLimiter()
    mockLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 1700000000 })
    const { checkRateLimit } = await import('@/lib/rate-limit')
    await checkRateLimit(buildRequest('/api/products', { 'x-forwarded-for': '1.2.3.4' }), 'user-xyz')
    expect(mockLimit).toHaveBeenCalledWith('user:user-xyz')
  })

  it('falls back to ip-scoped identifier when userId is null', async () => {
    setupMockLimiter()
    mockLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 1700000000 })
    const { checkRateLimit } = await import('@/lib/rate-limit')
    await checkRateLimit(buildRequest('/api/products', { 'x-forwarded-for': '5.6.7.8' }), null)
    expect(mockLimit).toHaveBeenCalledWith('ip:5.6.7.8')
  })

  it('returns null when the underlying limiter throws', async () => {
    setupMockLimiter()
    mockLimit.mockRejectedValue(new Error('redis down'))
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const result = await checkRateLimit(buildRequest('/api/products'))
    expect(result).toBeNull()
  })

  describe('buildIdentifier', () => {
    it('returns user-scoped identifier when userId is provided', async () => {
      setupMockLimiter()
      const { buildIdentifier } = await import('@/lib/rate-limit')
      expect(buildIdentifier('user-42', '1.2.3.4')).toBe('user:user-42')
    })

    it('returns ip-scoped identifier when userId is null', async () => {
      setupMockLimiter()
      const { buildIdentifier } = await import('@/lib/rate-limit')
      expect(buildIdentifier(null, '1.2.3.4')).toBe('ip:1.2.3.4')
    })
  })
})
