import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetToken = vi.hoisted(() => vi.fn())
const mockGetFeatureFlags = vi.hoisted(() => vi.fn())
const mockGeneralLimit = vi.hoisted(() => vi.fn())

vi.mock('next-auth/jwt', () => ({
  getToken: mockGetToken,
}))

vi.mock('@/lib/edge-config', () => ({
  getFeatureFlags: mockGetFeatureFlags,
}))

vi.mock('@/lib/rate-limit', () => ({
  GENERAL_RATE_LIMIT_MAX_REQUESTS: 60,
  STRICT_RATE_LIMIT_MAX_REQUESTS: 10,
  getStrictLimiter: () => ({ limit: mockGeneralLimit }),
  getGeneralLimiter: () => ({ limit: mockGeneralLimit }),
  buildIdentifier: (userId: string | null, ip: string) =>
    userId ? `user:${userId}` : `ip:${ip}`,
}))

const createRequest = (
  url: string,
  headers: Record<string, string> = {}
): NextRequest =>
  new NextRequest(url, {
    headers: {
      'x-forwarded-proto': 'https',
      host: 'example.com',
      ...headers,
    },
  })

// The proxy caches its Upstash AI limiter and in-memory counters at module
// scope, so each test imports a fresh module instance.
const importProxy = async () => {
  const proxyModule = await import('../src/proxy')
  return proxyModule.proxy
}

describe('proxy security perimeter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')

    mockGetToken.mockResolvedValue(null)
    mockGetFeatureFlags.mockResolvedValue({ maintenanceMode: false })
    mockGeneralLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60_000,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('HTTPS enforcement', () => {
    it('redirects plain http requests to https outside development', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/shop?page=2', {
          'x-forwarded-proto': 'http',
          host: 'example.com',
        })
      )

      expect(response.status).toBe(301)
      expect(response.headers.get('location')).toBe(
        'https://example.com/shop?page=2'
      )
      // Security headers are still attached to the redirect.
      expect(response.headers.get('Content-Security-Policy')).toContain(
        "default-src 'self'"
      )
    })

    it('redirects when the x-forwarded-proto header is absent', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const proxy = await importProxy()

      const request = new NextRequest('https://example.com/cart', {
        headers: { host: 'example.com' },
      })
      const response = await proxy(request)

      expect(response.status).toBe(301)
      expect(response.headers.get('location')).toBe('https://example.com/cart')
    })

    it('does not redirect https requests', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const proxy = await importProxy()

      const response = await proxy(createRequest('https://example.com/shop'))

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('does not redirect http requests in development', async () => {
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('http://localhost:3000/shop', {
          'x-forwarded-proto': 'http',
          host: 'localhost:3000',
        })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('AI rate limiting', () => {
    it('falls back to in-memory limiting and blocks past the AI quota', async () => {
      const proxy = await importProxy()
      const headers = { 'cf-connecting-ip': '203.0.113.100' }

      const first = await proxy(
        createRequest('https://example.com/api/ai', headers)
      )
      expect(first.status).toBe(200)
      expect(first.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(first.headers.get('X-RateLimit-Remaining')).toBe('9')

      let last = first
      for (let attempt = 0; attempt < 10; attempt += 1) {
        last = await proxy(createRequest('https://example.com/api/ai', headers))
      }

      expect(last.status).toBe(429)
      expect(last.headers.get('Retry-After')).toBeTruthy()
      expect(last.headers.get('X-RateLimit-Remaining')).toBe('0')
      // The general limiter is not consulted for AI paths.
      expect(mockGeneralLimit).not.toHaveBeenCalled()
    })

    it('uses the distributed limiter when Upstash credentials are configured', async () => {
      const upstashLimit = vi.fn().mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60_000,
      })
      vi.doMock('@/lib/rate-limiter', () => ({
        createEdgeRateLimiter: vi.fn(() => ({ limit: upstashLimit })),
        InMemoryRateLimiter: class {
          async limit() {
            return { success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 }
          }
        },
      }))
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.test')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/api/ai/chat', {
          'cf-connecting-ip': '203.0.113.101',
        })
      )

      expect(upstashLimit).toHaveBeenCalledWith('ip:203.0.113.101')
      expect(response.status).toBe(429)
    })

    it('degrades to in-memory limiting when the distributed limiter throws', async () => {
      vi.doMock('@/lib/rate-limiter', () => ({
        createEdgeRateLimiter: vi.fn(() => ({
          limit: vi.fn().mockRejectedValue(new Error('redis down')),
        })),
        InMemoryRateLimiter: class {
          async limit() {
            return { success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 }
          }
        },
      }))
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.test')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/api/ai', {
          'cf-connecting-ip': '203.0.113.102',
        })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    })
  })

  describe('maintenance mode', () => {
    beforeEach(() => {
      mockGetFeatureFlags.mockResolvedValue({ maintenanceMode: true })
    })

    it('returns a JSON 503 for API routes', async () => {
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/api/cart')
      )

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: 'Service temporarily unavailable for maintenance.',
      })
    })

    it('returns an HTML 503 page for non-API routes', async () => {
      const proxy = await importProxy()

      const response = await proxy(createRequest('https://example.com/shop'))

      expect(response.status).toBe(503)
      expect(response.headers.get('Content-Type')).toBe(
        'text/html; charset=utf-8'
      )
      expect(response.headers.get('Retry-After')).toBe('300')
      await expect(response.text()).resolves.toContain('Under Maintenance')
    })

    it.each([
      '/api/health',
      '/api/inngest',
      '/api/auth/session',
      '/auth/signin',
    ])('exempts %s from maintenance mode', async (pathname) => {
      const proxy = await importProxy()

      const response = await proxy(
        createRequest(`https://example.com${pathname}`)
      )

      expect(response.status).not.toBe(503)
    })

    it('allows the request through when Edge Config lookup fails', async () => {
      mockGetFeatureFlags.mockRejectedValue(new Error('edge config down'))
      const proxy = await importProxy()

      const response = await proxy(createRequest('https://example.com/shop'))

      expect(response.status).toBe(200)
    })
  })

  describe('admin gate', () => {
    it('returns 401 for unauthenticated admin API requests', async () => {
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/api/admin/orders')
      )

      expect(response.status).toBe(401)
    })

    it('redirects unauthenticated admin page requests to sign-in', async () => {
      const proxy = await importProxy()

      const response = await proxy(createRequest('https://example.com/admin'))

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'https://example.com/auth/signin?callbackUrl=%2Fadmin'
      )
    })

    it('returns 403 for admin API requests from non-staff roles', async () => {
      mockGetToken.mockResolvedValue({ id: 'user-1', role: 'CUSTOMER' })
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/api/admin/orders')
      )

      expect(response.status).toBe(403)
    })

    it('redirects non-staff users away from admin pages', async () => {
      mockGetToken.mockResolvedValue({ id: 'user-1', role: 'CUSTOMER' })
      const proxy = await importProxy()

      const response = await proxy(createRequest('https://example.com/admin'))

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('https://example.com/')
    })

    it('redirects staff without the section permission back to the dashboard', async () => {
      mockGetToken.mockResolvedValue({ id: 'user-2', role: 'FULFILMENT' })
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/admin/users?page=2')
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('https://example.com/admin')
    })

    it('allows staff with the required section permission', async () => {
      mockGetToken.mockResolvedValue({ id: 'user-3', role: 'ADMIN' })
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/admin/users')
      )

      expect(response.status).toBe(200)
    })

    it('treats a missing NEXTAUTH_SECRET as unauthenticated', async () => {
      vi.stubEnv('NEXTAUTH_SECRET', '')
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/api/admin/orders')
      )

      expect(response.status).toBe(401)
      expect(mockGetToken).not.toHaveBeenCalled()
    })

    it('treats a failing token lookup as unauthenticated', async () => {
      mockGetToken.mockRejectedValue(new Error('bad token'))
      const proxy = await importProxy()

      const response = await proxy(
        createRequest('https://example.com/api/admin/orders')
      )

      expect(response.status).toBe(401)
    })
  })
})
