import { getRedisClient } from '@/lib/redis'
import { logCacheOperation, logError } from '@/lib/logger'

const AI_CACHE_TTL = 3600 // 1 hour
const AI_CACHE_PREFIX = 'ai:response:'

/**
 * Generate a normalized cache key from productId and user question.
 * Normalizes the question by lowercasing, trimming, and collapsing whitespace
 * to maximize cache hit rates for semantically similar questions.
 */
export function buildAiCacheKey(productId: string, question: string): string {
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ')
  // Use a simple hash to keep keys short
  const hash = Math.abs(
    Array.from(normalized).reduce(
      (h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0,
      0
    )
  )
  return `${AI_CACHE_PREFIX}${productId}:${hash}`
}

export async function getCachedAiResponse(
  productId: string,
  question: string
): Promise<string | null> {
  const redis = getRedisClient()
  if (!redis) return null

  const key = buildAiCacheKey(productId, question)
  try {
    const cached = await redis.get<string>(key)
    if (cached !== null) {
      logCacheOperation({ operation: 'hit', key, success: true })
      return cached
    }
    logCacheOperation({ operation: 'miss', key, success: true })
    return null
  } catch (error) {
    logError({ error, context: 'ai_cache_get', additionalInfo: { key } })
    return null
  }
}

export async function setCachedAiResponse(
  productId: string,
  question: string,
  response: string
): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  const key = buildAiCacheKey(productId, question)
  try {
    await redis.setex(key, AI_CACHE_TTL, response)
    logCacheOperation({ operation: 'set', key, ttl: AI_CACHE_TTL, success: true })
  } catch (error) {
    logError({ error, context: 'ai_cache_set', additionalInfo: { key } })
  }
}
