import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetToken = vi.hoisted(() => vi.fn())
const mockGetFeatureFlags = vi.hoisted(() => vi.fn())
const mockStrictLimit = vi.hoisted(() => vi.fn())
const mockGeneralLimit = vi.hoisted(() => vi.fn())
const mockGetStrictLimiter = vi.hoisted(() => vi.fn())
const mockGetGeneralLimiter = vi.hoisted(() => vi.fn())

vi.mock('next-auth/jwt', () => ({
  getToken: mockGetToken,
}))

vi.mock('@/lib/edge-config', () => ({
  getFeatureFlags: mockGetFeatureFlags,
}))

vi.mock('@/lib/rate-limit', () => ({
  GENERAL_RATE_LIMIT_MAX_REQUESTS: 60,
  STRICT_RATE_LIMIT_MAX_REQUESTS: 10,
  getStrictLimiter: mockGetStrictLimiter,
  getGeneralLimiter: mockGetGeneralLimiter,
}))

import { config, proxy } from '../src/proxy'

const MOCK_RESET_TIMESTAMP = Date.now() + 60_000

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
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')

    mockGetToken.mockResolvedValue(null)
    mockGetFeatureFlags.mockResolvedValue({ maintenanceMode: false })

    mockStrictLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: MOCK_RESET_TIMESTAMP,
    })
    mockGeneralLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: MOCK_RESET_TIMESTAMP,
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
    expect(response.headers.get('X-RateLimit-Reset')).toBe(
      String(MOCK_RESET_TIMESTAMP)
    )
  })

  it('prefers authenticated user id for limiter identifier', async () => {
    mockGetToken.mockResolvedValue({ id: 'user-42', role: 'CUSTOMER' })

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

  it('uses immediate proxy ip when x-forwarded-for chain is not trusted', async () => {
    process.env.TRUSTED_PROXY_IPS = '10.0.0.1'

    await proxy(
      createRequest('/api/orders', {
        'x-forwarded-for': '198.51.100.25, 10.0.0.2',
      })
    )

    expect(mockGeneralLimit).toHaveBeenCalledWith('ip:10.0.0.2')
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

  it.each([
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ])('applies the strict limiter to %s', async (pathname) => {
    await proxy(createRequest(pathname, { 'cf-connecting-ip': '203.0.113.40' }))

    expect(mockStrictLimit).toHaveBeenCalledWith('ip:203.0.113.40')
    expect(mockGeneralLimit).not.toHaveBeenCalled()
  })

  it.each([
    '/api/cart',
    '/api/wishlist',
    '/api/reviews',
    '/api/upload',
    '/api/account',
    '/api/search/suggest',
  ])('applies the general limiter to %s', async (pathname) => {
    await proxy(createRequest(pathname, { 'cf-connecting-ip': '203.0.113.50' }))

    expect(mockGeneralLimit).toHaveBeenCalledWith('ip:203.0.113.50')
    expect(mockStrictLimit).not.toHaveBeenCalled()
  })

  it('returns 429 for a general sensitive path when blocked', async () => {
    mockGeneralLimit.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 60_000,
    })

    const response = await proxy(
      createRequest('/api/cart', { 'cf-connecting-ip': '203.0.113.60' })
    )

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeTruthy()
  })

  it('returns 503 for strict reset-password path when limiter is unavailable', async () => {
    mockGetStrictLimiter.mockReturnValue(null)

    const response = await proxy(
      createRequest('/api/auth/reset-password', {
        'cf-connecting-ip': '203.0.113.70',
      })
    )

    expect(response.status).toBe(503)
  })

  it('falls back to in-memory limiting for general paths when limiter is unavailable', async () => {
    mockGetGeneralLimiter.mockReturnValue(null)

    const response = await proxy(
      createRequest('/api/cart', { 'cf-connecting-ip': '203.0.113.80' })
    )

    // Not blocked on the first request, but still counted (headers present),
    // so the route is never left fully unbounded when Upstash is down.
    expect(response.status).not.toBe(503)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy()
  })

  it('adds nonce-based CSP headers without unsafe-inline', async () => {
    const response = await proxy(createRequest('/shop'))
    const nonce = response.headers.get('x-nonce')
    const csp = response.headers.get('Content-Security-Policy')

    expect(nonce).toBeTruthy()
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`)
    expect(csp).toContain(`style-src 'self' 'nonce-${nonce}'`)
    expect(csp).not.toContain("'unsafe-inline'")
  })

  it('matches broad app routes while excluding Next.js static assets', () => {
    expect(config.matcher).toContain(
      '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)'
    )
  })
})
