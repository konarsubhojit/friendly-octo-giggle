import type { NextRequest } from 'next/server'
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitResult,
} from './rate-limiter'

let generalLimiter: RateLimiter | null = null
let strictLimiter: RateLimiter | null = null

export const GENERAL_RATE_LIMIT_MAX_REQUESTS = 60
export const STRICT_RATE_LIMIT_MAX_REQUESTS = 10

export const getGeneralLimiter = (): RateLimiter | null => {
  generalLimiter ??= createRateLimiter({
    maxRequests: GENERAL_RATE_LIMIT_MAX_REQUESTS,
    prefix: 'rl:general',
  })
  return generalLimiter
}

export const getStrictLimiter = (): RateLimiter | null => {
  strictLimiter ??= createRateLimiter({
    maxRequests: STRICT_RATE_LIMIT_MAX_REQUESTS,
    prefix: 'rl:strict',
  })
  return strictLimiter
}

/**
 * Build a rate-limit bucket identifier that is scoped to the authenticated
 * user when available, so that individual users on shared mobile IP addresses
 * (CGNAT) don't exhaust each other's buckets.
 */
export const buildIdentifier = (
  userId: string | null,
  ipAddress: string
): string => (userId ? `user:${userId}` : `ip:${ipAddress}`)

const getIdentifier = (
  request: NextRequest,
  userId?: string | null
): string => {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'
  return buildIdentifier(userId ?? null, ip)
}

// Paths matched by prefix that use the strict (low-cap) rate limiter.
const STRICT_PREFIX_PATHS = [
  '/api/auth',
  '/api/orders',
  '/api/ai',
  '/api/upload',
  '/api/search',
  // Coupon redemption previews are brute-forceable, so they get the low cap.
  '/api/cart/coupon',
]

// Paths matched EXACTLY (not by prefix) that use the strict rate limiter.
// Using exact match here prevents read-only sub-paths (e.g. GET /api/checkout/{id})
// from sharing the same tight bucket as the write endpoint (POST /api/checkout).
const STRICT_EXACT_PATHS = ['/api/checkout']

const isStrictPath = (pathname: string): boolean =>
  STRICT_EXACT_PATHS.includes(pathname) ||
  STRICT_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix))

export const checkRateLimit = async (
  request: NextRequest,
  userId?: string | null
): Promise<RateLimitResult | null> => {
  try {
    const pathname = request.nextUrl.pathname
    const limiter = isStrictPath(pathname)
      ? getStrictLimiter()
      : getGeneralLimiter()

    if (!limiter) return null

    const identifier = getIdentifier(request, userId)
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch {
    return null
  }
}
