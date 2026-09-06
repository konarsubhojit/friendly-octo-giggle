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

describe('login-protection service', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLimit.mockReset()
  })

  it('extracts client IP from x-forwarded-for', async () => {
    setupMockLimiter()
    const { getClientIpFromRequest } =
      await import('@/features/auth/services/login-protection')
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.1' },
    })
    expect(getClientIpFromRequest(request)).toBe('203.0.113.10')
  })

  it('does not throttle when rate limiter is unavailable', async () => {
    setupNullLimiter()
    const mod = await import('@/features/auth/services/login-protection')

    const result = await mod.recordFailedLoginAttempt({
      userId: 'user-1',
      ipAddress: '203.0.113.10',
    })

    expect(result).toEqual({
      shouldLockAccount: false,
      shouldThrottleIp: false,
    })
  })

  it('marks account lock when user threshold is reached', async () => {
    setupMockLimiter()
    mockLimit
      .mockResolvedValueOnce({ success: true, remaining: 0 })
      .mockResolvedValueOnce({ success: true, remaining: 2 })

    const { recordFailedLoginAttempt } =
      await import('@/features/auth/services/login-protection')

    const result = await recordFailedLoginAttempt({
      userId: 'user-1',
      ipAddress: '203.0.113.10',
    })

    expect(result).toEqual({
      shouldLockAccount: true,
      shouldThrottleIp: false,
    })
  })

  it('marks IP throttle when IP threshold is reached', async () => {
    setupMockLimiter()
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 })

    const { recordFailedLoginAttempt } =
      await import('@/features/auth/services/login-protection')

    const result = await recordFailedLoginAttempt({
      ipAddress: '203.0.113.10',
    })

    expect(result).toEqual({
      shouldLockAccount: false,
      shouldThrottleIp: true,
    })
  })

  it('computes account lock duration at 15 minutes', async () => {
    setupMockLimiter()
    const { ACCOUNT_LOCK_DURATION_MS, getAccountLockUntil } =
      await import('@/features/auth/services/login-protection')

    vi.useFakeTimers()
    try {
      const now = new Date('2026-01-01T00:00:00.000Z')
      vi.setSystemTime(now)

      const lockUntil = getAccountLockUntil().getTime()

      expect(lockUntil - now.getTime()).toBe(ACCOUNT_LOCK_DURATION_MS)
    } finally {
      vi.useRealTimers()
    }
  })
})
