import { Ratelimit } from '@upstash/ratelimit'
import type { NextRequest } from 'next/server'
import { getRedisClient } from './redis'

type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

let generalLimiter: Ratelimit | null = null
let strictLimiter: Ratelimit | null = null

const getGeneralLimiter = (): Ratelimit | null => {
  const redis = getRedisClient()
  if (!redis) return null
  if (!generalLimiter) {
    generalLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'rl:general',
    })
  }
  return generalLimiter
}

const getStrictLimiter = (): Ratelimit | null => {
  const redis = getRedisClient()
  if (!redis) return null
  if (!strictLimiter) {
    strictLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:strict',
    })
  }
  return strictLimiter
}

const getIdentifier = (request: NextRequest): string => {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'
  return ip
}

const STRICT_PATHS = [
  '/api/auth',
  '/api/checkout',
  '/api/orders',
  '/api/ai',
  '/api/upload',
  '/api/search',
]

const isStrictPath = (pathname: string): boolean =>
  STRICT_PATHS.some((prefix) => pathname.startsWith(prefix))

export const checkRateLimit = async (
  request: NextRequest
): Promise<RateLimitResult | null> => {
  try {
    const pathname = request.nextUrl.pathname
    const limiter = isStrictPath(pathname)
      ? getStrictLimiter()
      : getGeneralLimiter()

    if (!limiter) return null

    const identifier = getIdentifier(request)
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
