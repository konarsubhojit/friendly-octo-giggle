import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { auth } from '@/lib/auth'
import { getFeatureFlags } from '@/lib/edge-config'
import {
  GENERAL_RATE_LIMIT_MAX_REQUESTS,
  getGeneralLimiter,
  getStrictLimiter,
  STRICT_RATE_LIMIT_MAX_REQUESTS,
} from '@/lib/rate-limit'

const isDev = process.env.NODE_ENV === 'development'
const ADMIN_PATH_PREFIX = '/admin'
const ADMIN_API_PREFIX = '/api/admin'

const RATE_LIMIT_PATHS = [
  '/api/auth/register',
  '/api/auth/change-password',
  '/api/auth/callback/credentials',
  '/api/checkout',
  '/api/orders',
]
const STRICT_RATE_LIMIT_PATHS = [
  '/api/auth/register',
  '/api/auth/change-password',
  '/api/auth/callback/credentials',
]

const AI_RATE_LIMIT_PATHS = ['/api/ai']
const AI_RATE_LIMIT_MAX_REQUESTS = 10 // stricter: 10 per minute for AI

// In-memory sliding-window counters keyed by IP + path prefix.
// Used as a fallback when Redis is unavailable for AI paths.
const aiRateLimitStore = new Map<string, { count: number; resetAt: number }>()

type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

type SessionUser = {
  id?: string | null
  role?: string | null
}

type SessionLike = {
  user?: SessionUser | null
} | null

// Distributed rate limiter for AI routes — enforced across all serverless
// instances via Upstash Redis to prevent per-instance bypasses.
let aiLimiter: Ratelimit | null = null

const getAiLimiter = (): Ratelimit | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  if (!aiLimiter) {
    aiLimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(AI_RATE_LIMIT_MAX_REQUESTS, '60 s'),
      prefix: 'rl:ai',
    })
  }
  return aiLimiter
}

const createRateLimitHeaders = (result: RateLimitResult): HeadersInit => ({
  'X-RateLimit-Limit': String(result.limit),
  'X-RateLimit-Remaining': String(result.remaining),
  'X-RateLimit-Reset': String(result.reset),
})

const getRetryAfterSeconds = (reset: number): string =>
  String(Math.max(1, Math.ceil((reset - Date.now()) / 1000)))

const buildRateLimitedResponse = (result: RateLimitResult): NextResponse =>
  NextResponse.json(
    { success: false, error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        ...createRateLimitHeaders(result),
        'Retry-After': getRetryAfterSeconds(result.reset),
      },
    }
  )

const getTrustedProxyIps = (): Set<string> => {
  const rawTrustedProxies = process.env.TRUSTED_PROXY_IPS ?? ''
  return new Set(
    rawTrustedProxies
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
  )
}

const getClientIpFromHeaders = (headers: Headers): string => {
  const directIpHeaders = ['cf-connecting-ip', 'x-real-ip']
  for (const headerName of directIpHeaders) {
    const ip = headers.get(headerName)?.trim()
    if (ip) return ip
  }

  const forwardedFor = headers.get('x-forwarded-for')
  if (!forwardedFor) return 'unknown'

  const forwardedSegments = forwardedFor
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (forwardedSegments.length === 0) return 'unknown'
  if (forwardedSegments.length === 1) return forwardedSegments[0]

  const trustedProxyIps = getTrustedProxyIps()
  const immediateProxyIp = forwardedSegments.at(-1)
  if (immediateProxyIp && trustedProxyIps.has(immediateProxyIp)) {
    return forwardedSegments[0]
  }

  return immediateProxyIp ?? 'unknown'
}

const buildIdentifier = (userId: string | null, ipAddress: string): string =>
  userId ? `user:${userId}` : `ip:${ipAddress}`

const isStrictRateLimitPath = (pathname: string): boolean =>
  STRICT_RATE_LIMIT_PATHS.some((pathPrefix) => pathname.startsWith(pathPrefix))

const buildRateLimitUnavailableResponse = (limit: number): NextResponse => {
  const reset = Date.now() + 60_000
  const headers = createRateLimitHeaders({
    success: false,
    limit,
    remaining: 0,
    reset,
  })
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limiting service temporarily unavailable. Please try again.',
    },
    {
      status: 503,
      headers: {
        ...headers,
        'Retry-After': getRetryAfterSeconds(reset),
      },
    }
  )
}

function getInMemoryAiRateLimitResult(
  identifier: string,
  pathname: string
): RateLimitResult | null {
  const aiPrefix = AI_RATE_LIMIT_PATHS.find((p) => pathname.startsWith(p))
  if (!aiPrefix) return null

  const key = `${identifier}:${aiPrefix}`
  const now = Date.now()
  const entry = aiRateLimitStore.get(key)
  const reset = now + 60_000

  if (!entry || now > entry.resetAt) {
    aiRateLimitStore.set(key, { count: 1, resetAt: reset })
    return {
      success: true,
      limit: AI_RATE_LIMIT_MAX_REQUESTS,
      remaining: AI_RATE_LIMIT_MAX_REQUESTS - 1,
      reset,
    }
  }

  entry.count += 1
  return {
    success: entry.count <= AI_RATE_LIMIT_MAX_REQUESTS,
    limit: AI_RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, AI_RATE_LIMIT_MAX_REQUESTS - entry.count),
    reset: entry.resetAt,
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  )
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://va.vercel-scripts.com https://accounts.google.com https://login.microsoftonline.com https://graph.microsoft.com https://*.ingest.de.sentry.io",
    "frame-src 'self' https://accounts.google.com https://login.microsoftonline.com",
  ].join('; ')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  let rateLimitHeaders: HeadersInit | null = null
  let cachedSession: SessionLike | undefined

  const getSession = async (): Promise<SessionLike> => {
    if (cachedSession !== undefined) {
      return cachedSession
    }
    const session = await auth()
    cachedSession = (session as SessionLike) ?? null
    return cachedSession
  }

  const withResponseHeaders = (response: NextResponse): NextResponse => {
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('x-nonce', nonce)
    if (rateLimitHeaders) {
      for (const [key, value] of Object.entries(rateLimitHeaders)) {
        response.headers.set(key, value)
      }
    }
    return response
  }

  // ── HTTPS redirect (production only) ──────────────────
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  if (process.env.NODE_ENV !== 'development' && proto === 'http') {
    const host = request.headers.get('host') || ''
    return withResponseHeaders(
      NextResponse.redirect(`https://${host}${pathname}${request.nextUrl.search}`, {
        status: 301,
      })
    )
  }

  // ── Rate limiting for sensitive endpoints ──────────────
  const isAiPath = AI_RATE_LIMIT_PATHS.some((p) => pathname.startsWith(p))
  const isSensitivePath = RATE_LIMIT_PATHS.some((p) => pathname.startsWith(p))
  const session = isAiPath || isSensitivePath ? await getSession() : null
  const userId = session?.user?.id?.trim() || null
  const ipAddress = getClientIpFromHeaders(request.headers)
  const identifier = buildIdentifier(userId, ipAddress)

  if (isAiPath) {
    // AI paths: distributed rate limiting via Upstash (works across all instances)
    const limiter = getAiLimiter()
    let rateLimitResult: RateLimitResult | null = null
    if (limiter) {
      try {
        const result = await limiter.limit(identifier)
        rateLimitResult = {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        }
      } catch {
        // Redis unavailable — fall back to in-memory limit
        rateLimitResult = getInMemoryAiRateLimitResult(identifier, pathname)
      }
    } else {
      rateLimitResult = getInMemoryAiRateLimitResult(identifier, pathname)
    }
    if (rateLimitResult && !rateLimitResult.success) {
      return withResponseHeaders(buildRateLimitedResponse(rateLimitResult))
    }
    if (rateLimitResult) {
      rateLimitHeaders = createRateLimitHeaders(rateLimitResult)
    }
  } else if (isSensitivePath) {
    const isStrictPath = isStrictRateLimitPath(pathname)
    const limiter = isStrictPath ? getStrictLimiter() : getGeneralLimiter()
    const fallbackLimit = isStrictPath
      ? STRICT_RATE_LIMIT_MAX_REQUESTS
      : GENERAL_RATE_LIMIT_MAX_REQUESTS
    let rateLimitResult: RateLimitResult = {
      success: true,
      limit: fallbackLimit,
      remaining: fallbackLimit,
      reset: Date.now() + 60_000,
    }

    if (!limiter) {
      if (isStrictPath) {
        return withResponseHeaders(
          buildRateLimitUnavailableResponse(fallbackLimit)
        )
      }
    } else {
      try {
        const result = await limiter.limit(identifier)
        rateLimitResult = {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        }
      } catch {
        if (isStrictPath) {
          return withResponseHeaders(
            buildRateLimitUnavailableResponse(fallbackLimit)
          )
        }
      }
    }

    if (!rateLimitResult.success) {
      return withResponseHeaders(buildRateLimitedResponse(rateLimitResult))
    }
    rateLimitHeaders = createRateLimitHeaders(rateLimitResult)
  }

  // ── Maintenance mode (Edge Config) ────────────────────
  // Skip for admin paths, API health, cron, and auth routes so operators
  // can still access the system during maintenance.
  const isExemptFromMaintenance =
    pathname.startsWith(ADMIN_PATH_PREFIX) ||
    pathname.startsWith(ADMIN_API_PREFIX) ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth')

  if (!isExemptFromMaintenance) {
    try {
      const flags = await getFeatureFlags()
      if (flags.maintenanceMode) {
        // For API routes return a JSON response; for pages return 503.
        if (pathname.startsWith('/api/')) {
          return withResponseHeaders(
            NextResponse.json(
              {
                success: false,
                error: 'Service temporarily unavailable for maintenance.',
              },
              { status: 503 }
            )
          )
        }
        // For non-API routes, return an HTML maintenance page.
        return withResponseHeaders(
          new NextResponse(
            `<!DOCTYPE html><html><head><title>Maintenance</title></head><body><h1>Under Maintenance</h1><p>We're performing scheduled maintenance. Please check back shortly.</p></body></html>`,
            {
              status: 503,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Retry-After': '300',
              },
            }
          )
        )
      }
    } catch {
      // Edge Config unavailable — allow request through (graceful degradation)
    }
  }

  // ── Admin route protection ────────────────────────────
  const isAdminRoute =
    pathname.startsWith(ADMIN_PATH_PREFIX) ||
    pathname.startsWith(ADMIN_API_PREFIX)

  if (isAdminRoute) {
    const currentSession = await getSession()

    if (!currentSession?.user) {
      if (pathname.startsWith('/api/')) {
        return withResponseHeaders(
          NextResponse.json(
            { success: false, error: 'Not authenticated' },
            { status: 401 }
          )
        )
      }
      const signInUrl = request.nextUrl.clone()
      signInUrl.pathname = '/auth/signin'
      signInUrl.searchParams.set('callbackUrl', pathname)
      return withResponseHeaders(NextResponse.redirect(signInUrl))
    }

    if (currentSession.user.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return withResponseHeaders(
          NextResponse.json(
            { success: false, error: 'Not authorized - Admin access required' },
            { status: 403 }
          )
        )
      }
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      return withResponseHeaders(NextResponse.redirect(homeUrl))
    }
  }

  return withResponseHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
}
