import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.hoisted(() => vi.fn())
const mockSlidingWindow = vi.hoisted(() => vi.fn(() => 'sliding-window'))
const mockGetRedisClient = vi.hoisted(() => vi.fn())

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    constructor(_config: unknown) {
      void _config
    }
    limit = mockLimit
    static slidingWindow = mockSlidingWindow
  }
  return { Ratelimit }
})

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
}))

describe('password-reset token helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLimit.mockReset()
    mockGetRedisClient.mockReset()
  })

  it('normalizeEmailForLookup trims and lowercases', async () => {
    const { normalizeEmailForLookup } =
      await import('@/features/auth/services/password-reset')
    expect(normalizeEmailForLookup('  Foo@Bar.COM  ')).toBe('foo@bar.com')
  })

  it('createPasswordResetIdentifier prefixes user ids', async () => {
    const { createPasswordResetIdentifier } =
      await import('@/features/auth/services/password-reset')
    expect(createPasswordResetIdentifier('u1')).toBe('password-reset:u1')
  })

  it('parsePasswordResetIdentifier strips/null-checks the prefix', async () => {
    const { parsePasswordResetIdentifier } =
      await import('@/features/auth/services/password-reset')
    expect(parsePasswordResetIdentifier('password-reset:abc')).toBe('abc')
    expect(parsePasswordResetIdentifier('email-verify:abc')).toBeNull()
  })

  it('hashPasswordResetToken returns deterministic sha256 hex', async () => {
    const { hashPasswordResetToken } =
      await import('@/features/auth/services/password-reset')
    const hash = hashPasswordResetToken('tok')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashPasswordResetToken('tok')).toBe(hash)
  })

  it('generatePasswordResetToken yields plainToken/hash/expiry consistently', async () => {
    const mod = await import('@/features/auth/services/password-reset')
    const before = Date.now()
    const { plainToken, tokenHash, expiresAt } =
      mod.generatePasswordResetToken()
    const after = Date.now()

    expect(plainToken).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenHash).toBe(mod.hashPasswordResetToken(plainToken))
    const ttl = 30 * 60 * 1000
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttl)
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + ttl)
  })
})

describe('consumeForgotPasswordRateLimits', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLimit.mockReset()
    mockGetRedisClient.mockReset()
  })

  it('returns false flags when redis is unavailable', async () => {
    mockGetRedisClient.mockReturnValue(null)
    const { consumeForgotPasswordRateLimits } =
      await import('@/features/auth/services/password-reset')
    await expect(
      consumeForgotPasswordRateLimits({
        email: 'user@example.com',
        ipAddress: '1.1.1.1',
      })
    ).resolves.toEqual({ emailLimited: false, ipLimited: false })
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('marks emailLimited when the email limiter denies', async () => {
    mockGetRedisClient.mockReturnValue({})
    mockLimit
      .mockResolvedValueOnce({ success: false }) // email
      .mockResolvedValueOnce({ success: true }) // ip
    const { consumeForgotPasswordRateLimits } =
      await import('@/features/auth/services/password-reset')

    const result = await consumeForgotPasswordRateLimits({
      email: 'user@example.com',
      ipAddress: '1.1.1.1',
    })
    expect(result).toEqual({ emailLimited: true, ipLimited: false })
  })

  it('marks ipLimited when the ip limiter denies', async () => {
    mockGetRedisClient.mockReturnValue({})
    mockLimit
      .mockResolvedValueOnce({ success: true }) // email
      .mockResolvedValueOnce({ success: false }) // ip
    const { consumeForgotPasswordRateLimits } =
      await import('@/features/auth/services/password-reset')

    const result = await consumeForgotPasswordRateLimits({
      email: 'user@example.com',
      ipAddress: '1.1.1.1',
    })
    expect(result).toEqual({ emailLimited: false, ipLimited: true })
  })
})

describe('consumeResetPasswordRateLimits', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLimit.mockReset()
    mockGetRedisClient.mockReset()
  })

  it('returns false flags when redis is unavailable', async () => {
    mockGetRedisClient.mockReturnValue(null)
    const { consumeResetPasswordRateLimits } =
      await import('@/features/auth/services/password-reset')
    await expect(
      consumeResetPasswordRateLimits({
        identifier: 'password-reset:u1',
        ipAddress: '1.1.1.1',
      })
    ).resolves.toEqual({ identifierLimited: false, ipLimited: false })
  })

  it('flags identifierLimited and ipLimited per limiter response', async () => {
    mockGetRedisClient.mockReturnValue({})
    mockLimit
      .mockResolvedValueOnce({ success: false }) // identifier
      .mockResolvedValueOnce({ success: false }) // ip
    const { consumeResetPasswordRateLimits } =
      await import('@/features/auth/services/password-reset')

    const result = await consumeResetPasswordRateLimits({
      identifier: 'password-reset:u1',
      ipAddress: '1.1.1.1',
    })
    expect(result).toEqual({ identifierLimited: true, ipLimited: true })
  })
})
