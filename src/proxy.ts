import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getFeatureFlags } from '@/lib/edge-config'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type AppLocale,
  getLocaleFromPathname,
  isSupportedLocale,
  toLocalizedPathname,
} from '@/lib/i18n/config'
import {
  GENERAL_RATE_LIMIT_MAX_REQUESTS,
  getGeneralLimiter,
  getStrictLimiter,
  STRICT_RATE_LIMIT_MAX_REQUESTS,
} from '@/lib/rate-limit'

/**
 * Edge-only proxy (Next.js 16 `proxy.ts` convention).
 *
 * Composes the two previously-separate edge layers into one:
 *   1. Locale redirect / cookie refresh (was `middleware.ts`).
 *   2. Production security primitives: nonce-based CSP, Upstash-backed
 *      rate limiting for `/api/auth/*`, `/api/checkout`, `/api/orders`,
 *      `/api/ai`; Edge-Config-driven maintenance mode; HTTPS enforcement;
 *      and an admin auth + role gate on `/admin/*` and `/api/admin/*`
 *      (was `src/proxy.ts`).
 *
 * Edge-safety notes:
 *   - The admin gate reads the JWT via `getToken({ req, secret })` from
 *     `next-auth/jwt` instead of `auth()` from `@/lib/auth`. This avoids
 *     pulling the Drizzle adapter, `pino` logger, and `prom-client` metrics
 *     into the edge bundle. The full Node-side session machinery still lives
 *     in `@/lib/auth` and is used by server components / route handlers.
 *   - No logger / metrics calls are made here; the security primitives don't
 *     require them. Auth events that need persistence happen on the Node
 *     side (sign-in callbacks, route handlers).
 */

const isDev = process.env.NODE_ENV === 'development'
const ADMIN_PATH_PREFIX = '/admin'
const ADMIN_API_PREFIX = '/api/admin'

const PUBLIC_FILE = /\.(.*)$/

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
const generateNonce = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
const buildCspHeader = (nonce: string): string =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://va.vercel-scripts.com https://accounts.google.com https://login.microsoftonline.com https://graph.microsoft.com https://*.ingest.de.sentry.io",
    "frame-src 'self' https://accounts.google.com https://login.microsoftonline.com",
  ].join('; ')

type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

type AuthTokenLike = {
  id?: string | null
  role?: string | null
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

const getPreferredLocale = (request: NextRequest): AppLocale => {
  const fromCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  if (fromCookie && isSupportedLocale(fromCookie)) return fromCookie

  const languageHeader = request.headers.get('accept-language')
  const firstLanguage = languageHeader?.split(',')[0]?.split('-')[0]
  if (firstLanguage && isSupportedLocale(firstLanguage)) return firstLanguage

  return DEFAULT_LOCALE
}

const isLocaleEligiblePath = (pathname: string): boolean =>
  !pathname.startsWith('/_next') &&
  !pathname.startsWith('/api') &&
  !PUBLIC_FILE.test(pathname)

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const nonce = generateNonce()
  const csp = buildCspHeader(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  let rateLimitHeaders: HeadersInit | null = null
  let cachedToken: AuthTokenLike | undefined

  // Read the NextAuth JWT directly at the edge. Unlike `auth()` from
  // `@/lib/auth`, `getToken` pulls in only `next-auth/jwt` — no DB adapter,
  // no logger, no metrics — and so is safe in the edge runtime.
  const getAuthToken = async (): Promise<AuthTokenLike> => {
    if (cachedToken !== undefined) {
      return cachedToken
    }
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      cachedToken = null
      return cachedToken
    }
    try {
      const token = await getToken({
        req: request,
        secret,
        secureCookie: process.env.NODE_ENV === 'production',
        cookieName:
          process.env.NODE_ENV === 'production'
            ? '__Secure-next-auth.session-token'
            : 'next-auth.session-token',
      })
      if (!token) {
        cachedToken = null
      } else {
        const rawId = token.id
        const rawRole = token.role
        cachedToken = {
          id: typeof rawId === 'string' ? rawId : null,
          role: typeof rawRole === 'string' ? rawRole : null,
        }
      }
    } catch {
      cachedToken = null
    }
    return cachedToken
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
      NextResponse.redirect(
        `https://${host}${pathname}${request.nextUrl.search}`,
        {
          status: 301,
        }
      )
    )
  }

  // ── Rate limiting for sensitive endpoints ──────────────
  const isAiPath = AI_RATE_LIMIT_PATHS.some((p) => pathname.startsWith(p))
  const isSensitivePath = RATE_LIMIT_PATHS.some((p) => pathname.startsWith(p))
  const token = isAiPath || isSensitivePath ? await getAuthToken() : null
  const userId = token?.id?.trim() || null
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
            `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Maintenance</title></head><body><main><h1>Under Maintenance</h1><p>We're performing scheduled maintenance. Please check back shortly.</p></main></body></html>`,
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
    const currentToken = await getAuthToken()

    if (!currentToken?.id?.trim()) {
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

    if (currentToken.role !== 'ADMIN') {
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

  // ── Locale redirect / cookie refresh ──────────────────
  // Routes now live under `src/app/[locale]/...`, so locale is a real URL
  // segment instead of a rewritten-away prefix. We only need to redirect
  // unprefixed user-facing requests to a locale-prefixed URL; the request
  // then resolves directly to the `[locale]` route segment and can be
  // cached / ISR'd without the root layout having to read request headers.
  if (isLocaleEligiblePath(pathname)) {
    const localeFromPath = getLocaleFromPathname(pathname)
    if (!localeFromPath) {
      const locale = getPreferredLocale(request)
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = toLocalizedPathname(pathname, locale)
      redirectUrl.search = search
      const response = withResponseHeaders(NextResponse.redirect(redirectUrl))
      response.cookies.set(LOCALE_COOKIE_NAME, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
      return response
    }

    // Locale already present in the path — refresh the preference cookie so
    // the next bare-path visit lands on the same locale, then let the
    // request fall through to the route segment with security headers.
    const response = withResponseHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    )
    response.cookies.set(LOCALE_COOKIE_NAME, localeFromPath, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    return response
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
  // Union of the previous `middleware.ts` and `src/proxy.ts` matchers.
  // The security primitives need to see `/api/*`, while locale handling is
  // limited inline (see `isLocaleEligiblePath`).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
}
