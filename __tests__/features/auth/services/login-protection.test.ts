import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.hoisted(() => vi.fn())
const mockSlidingWindow = vi.hoisted(() => vi.fn(() => 'sliding-window'))
const mockGetRedisClient = vi.hoisted(() => vi.fn())
const mockRatelimit = vi.hoisted(() => vi.fn())

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    constructor(config: unknown) {
      mockRatelimit(config)
    }

    limit = mockLimit

    static slidingWindow = mockSlidingWindow
  }
  return { Ratelimit }
})

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
}))

import {
  ACCOUNT_LOCK_DURATION_MS,
  getAccountLockUntil,
  getClientIpFromRequest,
  recordFailedLoginAttempt,
} from '@/features/auth/services/login-protection'

describe('login-protection service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts client IP from x-forwarded-for', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.1' },
    })

    expect(getClientIpFromRequest(request)).toBe('203.0.113.10')
  })

  it('does not throttle when redis is unavailable', async () => {
    mockGetRedisClient.mockReturnValue(null)

    const result = await recordFailedLoginAttempt({
      userId: 'user-1',
      ipAddress: '203.0.113.10',
    })

    expect(result).toEqual({
      shouldLockAccount: false,
      shouldThrottleIp: false,
    })
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('marks account lock when user threshold is reached', async () => {
    mockGetRedisClient.mockReturnValue({} as object)
    mockLimit
      .mockResolvedValueOnce({ success: true, remaining: 0 })
      .mockResolvedValueOnce({ success: true, remaining: 2 })

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
    mockGetRedisClient.mockReturnValue({} as object)
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 })

    const result = await recordFailedLoginAttempt({
      ipAddress: '203.0.113.10',
    })

    expect(result).toEqual({
      shouldLockAccount: false,
      shouldThrottleIp: true,
    })
  })

  it('computes account lock duration at 15 minutes', () => {
    const now = Date.now()
    const lockUntil = getAccountLockUntil().getTime()

    expect(lockUntil - now).toBeLessThanOrEqual(ACCOUNT_LOCK_DURATION_MS)
    expect(lockUntil - now).toBeGreaterThan(ACCOUNT_LOCK_DURATION_MS - 2000)
  })
})
