import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getFeatureFlags } from '@/lib/edge-config'

const ADMIN_PATH_PREFIX = '/admin'
const ADMIN_API_PREFIX = '/api/admin'

const RATE_LIMIT_PATHS = [
  '/api/auth/register',
  '/api/auth/change-password',
  '/api/checkout',
  '/api/orders',
]

const AI_RATE_LIMIT_PATHS = ['/api/ai']
const AI_RATE_LIMIT_MAX_REQUESTS = 10 // stricter: 10 per minute for AI

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 20

// In-memory sliding-window counters keyed by IP + path prefix.
// This is per-instance only (acceptable for serverless cold-start isolation).
// For distributed rate limiting, replace with Upstash Ratelimit.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string, pathname: string): boolean {
  const aiPrefix = AI_RATE_LIMIT_PATHS.find((p) => pathname.startsWith(p))
  if (aiPrefix) {
    const key = `${ip}:${aiPrefix}`
    const now = Date.now()
    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
      return false
    }

    entry.count += 1
    return entry.count > AI_RATE_LIMIT_MAX_REQUESTS
  }

  const matchedPrefix = RATE_LIMIT_PATHS.find((p) => pathname.startsWith(p))
  if (!matchedPrefix) return false

  const key = `${ip}:${matchedPrefix}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count += 1
  return entry.count > RATE_LIMIT_MAX_REQUESTS
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── HTTPS redirect (production only) ──────────────────
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  if (process.env.NODE_ENV !== 'development' && proto === 'http') {
    const host = request.headers.get('host') || ''
    return NextResponse.redirect(
      `https://${host}${pathname}${request.nextUrl.search}`,
      { status: 301 }
    )
  }

  // ── Rate limiting for sensitive endpoints ──────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (isRateLimited(ip, pathname)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
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
          return NextResponse.json(
            {
              success: false,
              error: 'Service temporarily unavailable for maintenance.',
            },
            { status: 503 }
          )
        }
        // For non-API routes, return an HTML maintenance page.
        return new NextResponse(
          `<!DOCTYPE html><html><head><title>Maintenance</title></head>
           <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;background:#fdf6f0">
           <div style="text-align:center;max-width:480px;padding:2rem">
           <h1 style="font-size:2rem;margin-bottom:1rem">🛠️ Under Maintenance</h1>
           <p style="color:#666">We're performing scheduled maintenance. Please check back shortly.</p>
           </div></body></html>`,
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Retry-After': '300',
            },
          }
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
    const session = await auth()

    if (!session?.user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Not authenticated' },
          { status: 401 }
        )
      }
      const signInUrl = request.nextUrl.clone()
      signInUrl.pathname = '/auth/signin'
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }

    if (session.user.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Not authorized - Admin access required' },
          { status: 403 }
        )
      }
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      return NextResponse.redirect(homeUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/auth/register',
    '/api/auth/change-password',
    '/api/checkout/:path*',
    '/api/orders/:path*',
    '/api/ai/:path*',
  ],
}
