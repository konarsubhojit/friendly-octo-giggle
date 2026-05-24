import { Ratelimit } from '@upstash/ratelimit'
import { getRedisClient } from '@/lib/redis'

const FAILED_LOGIN_WINDOW = '15 m'
const MAX_FAILED_LOGIN_ATTEMPTS = 5
export const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000

let failedByUserLimiter: Ratelimit | null = null
let failedByIpLimiter: Ratelimit | null = null

const getFailedByUserLimiter = (): Ratelimit | null => {
  const redis = getRedisClient()
  if (!redis) return null

  if (!failedByUserLimiter) {
    failedByUserLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        MAX_FAILED_LOGIN_ATTEMPTS,
        FAILED_LOGIN_WINDOW
      ),
      prefix: 'rl:auth:failed:user',
    })
  }

  return failedByUserLimiter
}

const getFailedByIpLimiter = (): Ratelimit | null => {
  const redis = getRedisClient()
  if (!redis) return null

  if (!failedByIpLimiter) {
    failedByIpLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        MAX_FAILED_LOGIN_ATTEMPTS,
        FAILED_LOGIN_WINDOW
      ),
      prefix: 'rl:auth:failed:ip',
    })
  }

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
