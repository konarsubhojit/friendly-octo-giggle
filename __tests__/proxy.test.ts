import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
const mockGetFeatureFlags = vi.hoisted(() => vi.fn())
const mockStrictLimit = vi.hoisted(() => vi.fn())
const mockGeneralLimit = vi.hoisted(() => vi.fn())
const mockGetStrictLimiter = vi.hoisted(() => vi.fn())
const mockGetGeneralLimiter = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/edge-config', () => ({
  getFeatureFlags: mockGetFeatureFlags,
}))

vi.mock('@/lib/rate-limit', () => ({
  getStrictLimiter: mockGetStrictLimiter,
  getGeneralLimiter: mockGetGeneralLimiter,
}))

import { config, proxy } from '@/proxy'

const createRequest = (
  pathname: string,
  headers: Record<string, string> = {}
): NextRequest =>
  new NextRequest(`https://example.com${pathname}`, {
    headers: {
      'x-forwarded-proto': 'https',
      ...headers,
    },
  })

describe('proxy rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TRUSTED_PROXY_IPS
    vi.stubEnv('NODE_ENV', 'development')

    mockAuth.mockResolvedValue(null)
    mockGetFeatureFlags.mockResolvedValue({ maintenanceMode: false })

    mockStrictLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1_700_000_000_000,
    })
    mockGeneralLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 1_700_000_000_000,
    })

    mockGetStrictLimiter.mockReturnValue({ limit: mockStrictLimit })
    mockGetGeneralLimiter.mockReturnValue({ limit: mockGeneralLimit })
  })

  it('protects credentials callback path with strict limiter and response headers', async () => {
    const response = await proxy(
      createRequest('/api/auth/callback/credentials', {
        'cf-connecting-ip': '203.0.113.10',
      })
    )

    expect(mockStrictLimit).toHaveBeenCalledWith('ip:203.0.113.10')
    expect(mockGeneralLimit).not.toHaveBeenCalled()
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('9')
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1700000000000')
  })

  it('prefers authenticated user id for limiter identifier', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-42', role: 'CUSTOMER' },
    })

    await proxy(
      createRequest('/api/orders', {
        'cf-connecting-ip': '203.0.113.20',
      })
    )

    expect(mockGeneralLimit).toHaveBeenCalledWith('user:user-42')
  })

  it('uses x-forwarded-for first hop only when immediate proxy is trusted', async () => {
    process.env.TRUSTED_PROXY_IPS = '10.0.0.1'

    await proxy(
      createRequest('/api/orders', {
        'x-forwarded-for': '198.51.100.25, 10.0.0.1',
      })
    )

    expect(mockGeneralLimit).toHaveBeenCalledWith('ip:198.51.100.25')
  })

  it('returns 429 with consistent rate-limit headers when blocked', async () => {
    mockStrictLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60_000,
    })

    const response = await proxy(
      createRequest('/api/auth/callback/credentials', {
        'cf-connecting-ip': '203.0.113.30',
      })
    )

    expect(response.status).toBe(429)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
    expect(response.headers.get('Retry-After')).toBeTruthy()
  })

  it('includes credentials callback matcher in proxy config', () => {
    expect(config.matcher).toContain('/api/auth/callback/credentials')
  })
})
