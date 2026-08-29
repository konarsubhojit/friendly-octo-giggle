import { getRedisClient } from '@/lib/redis'
import {
  createEdgeRateLimiter,
  type RateLimiter,
} from '@/lib/rate-limiter'
import { env } from '@/lib/env'

const FAILED_LOGIN_WINDOW = '15 m'
const MAX_FAILED_LOGIN_ATTEMPTS = 5
export const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000

let failedByUserLimiter: RateLimiter | null = null
let failedByIpLimiter: RateLimiter | null = null

const getUpstashCreds = (): { url: string; token: string } | undefined => {
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : undefined
}

const getFailedByUserLimiter = (): RateLimiter | null => {
  const redis = getRedisClient()
  if (!redis) return null

  failedByUserLimiter ??= createEdgeRateLimiter(
    {
      maxRequests: MAX_FAILED_LOGIN_ATTEMPTS,
      windowSeconds: 15 * 60,
      prefix: 'rl:auth:failed:user',
    },
    getUpstashCreds()
  )

  return failedByUserLimiter
}

const getFailedByIpLimiter = (): RateLimiter | null => {
  const redis = getRedisClient()
  if (!redis) return null

  failedByIpLimiter ??= createEdgeRateLimiter(
    {
      maxRequests: MAX_FAILED_LOGIN_ATTEMPTS,
      windowSeconds: 15 * 60,
      prefix: 'rl:auth:failed:ip',
    },
    getUpstashCreds()
  )

  return failedByIpLimiter
}

const reachedAttemptThreshold = (result: {
  success: boolean
  remaining: number
}): boolean => !result.success || result.remaining === 0

export const getClientIpFromRequest = (request?: Request): string => {
  const forwardedFor = request?.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return request?.headers.get('x-real-ip') ?? 'unknown'
}

export const getAccountLockUntil = (): Date =>
  new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS)

export const recordFailedLoginAttempt = async ({
  userId,
  ipAddress,
}: {
  userId?: string
  ipAddress: string
}): Promise<{ shouldLockAccount: boolean; shouldThrottleIp: boolean }> => {
  const userLimiter = getFailedByUserLimiter()
  const ipLimiter = getFailedByIpLimiter()

  const [userResult, ipResult] = await Promise.all([
    userId && userLimiter ? userLimiter.limit(userId) : Promise.resolve(null),
    ipLimiter ? ipLimiter.limit(ipAddress) : Promise.resolve(null),
  ])

  return {
    shouldLockAccount: Boolean(
      userResult && reachedAttemptThreshold(userResult)
    ),
    shouldThrottleIp: Boolean(ipResult && reachedAttemptThreshold(ipResult)),
  }
}
