import { getRedisClient } from '@/lib/redis'
import type { DailyUsage } from './chat-types'

export const utcDateKey = (): string => new Date().toISOString().slice(0, 10)

export const secondsUntilNextUtcMidnight = (): number => {
  const now = new Date()
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  )
  return Math.max(1, Math.ceil((nextMidnightUtc - now.getTime()) / 1000))
}

const usageKey = (userId: string): string =>
  `ai:chat:usage:${userId}:${utcDateKey()}`

const advancedUsageKey = (userId: string): string =>
  `ai:chat:advanced:${userId}:${utcDateKey()}`

export const getDailyUsage = async (userId: string): Promise<DailyUsage> => {
  const redis = getRedisClient()
  if (!redis) return { requests: 0, tokens: 0 }

  const raw = (await redis.hgetall(usageKey(userId))) ?? {}
  const requests = Number(raw.requests ?? 0)
  const tokens = Number(raw.tokens ?? 0)
  return {
    requests: Number.isFinite(requests) ? requests : 0,
    tokens: Number.isFinite(tokens) ? tokens : 0,
  }
}

export const recordDailyUsage = async (
  userId: string,
  tokenCount: number
): Promise<void> => {
  const redis = getRedisClient()
  if (!redis) return

  const key = usageKey(userId)
  await redis.hincrby(key, 'requests', 1)
  await redis.hincrby(key, 'tokens', tokenCount)
  await redis.expire(key, secondsUntilNextUtcMidnight())
}

export const adjustDailyTokenUsage = async (
  userId: string,
  tokenDelta: number
): Promise<void> => {
  if (tokenDelta === 0) return
  const redis = getRedisClient()
  if (!redis) return

  const key = usageKey(userId)
  await redis.hincrby(key, 'tokens', tokenDelta)
  await redis.expire(key, secondsUntilNextUtcMidnight())
}

export const getAdvancedUsage = async (userId: string): Promise<number> => {
  const redis = getRedisClient()
  if (!redis) return 0
  const raw = (await redis.hgetall(advancedUsageKey(userId))) ?? {}
  const requests = Number(raw.requests ?? 0)
  return Number.isFinite(requests) ? requests : 0
}

export const recordAdvancedUsage = async (userId: string): Promise<void> => {
  const redis = getRedisClient()
  if (!redis) return
  const key = advancedUsageKey(userId)
  await redis.hincrby(key, 'requests', 1)
  await redis.expire(key, secondsUntilNextUtcMidnight())
}

export type QuotaCheckParams = {
  userId: string
  dailyUsage: DailyUsage
  reservedTotalTokens: number
  requestQuota: number
  tokenQuota: number
  usesAdvancedFeatures: boolean
  advancedQuota: number
}

/**
 * Returns an error message when a quota would be exceeded, otherwise records
 * advanced-feature usage and returns null.
 */
export const enforceQuotas = async (
  params: QuotaCheckParams
): Promise<string | null> => {
  if (params.dailyUsage.requests + 1 > params.requestQuota) {
    return 'Daily AI chat request quota exceeded'
  }
  if (
    params.dailyUsage.tokens + params.reservedTotalTokens >
    params.tokenQuota
  ) {
    return 'Daily AI chat token quota exceeded'
  }
  if (params.usesAdvancedFeatures) {
    const advancedUsage = await getAdvancedUsage(params.userId)
    if (advancedUsage + 1 > params.advancedQuota) {
      return 'Daily advanced AI request quota exceeded'
    }
    await recordAdvancedUsage(params.userId)
  }
  return null
}
