import { getRedisClient } from '@/lib/redis'
import { logCacheOperation, logError } from '@/lib/logger'
import type { CurrencyCode } from '@/lib/currency'
import type { AssistantSurface } from '@/features/ai/services/chat-types'

const AI_CACHE_TTL = 3600 // 1 hour
const AI_CACHE_PREFIX = 'ai:response:'

/**
 * Generate a collision-free cache key from surface, currencyCode and user question.
 * Normalizes the question by lowercasing, trimming, and collapsing whitespace
 * to maximize cache hit rates for semantically similar questions.
 * Only used for single-turn (no conversation history) requests.
 */
export function buildAiCacheKey(
  surface: AssistantSurface,
  question: string,
  currencyCode: CurrencyCode = 'INR'
): string {
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ')
  return `${AI_CACHE_PREFIX}${surface}:${currencyCode}:${normalized}`
}

export async function getCachedAiResponse(
  surface: AssistantSurface,
  question: string,
  currencyCode: CurrencyCode = 'INR'
): Promise<string | null> {
  const redis = getRedisClient()
  if (!redis) return null

  const key = buildAiCacheKey(surface, question, currencyCode)
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
  surface: AssistantSurface,
  question: string,
  currencyCode: CurrencyCode,
  response: string
): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  const key = buildAiCacheKey(surface, question, currencyCode)
  try {
    await redis.setex(key, AI_CACHE_TTL, response)
    logCacheOperation({
      operation: 'set',
      key,
      ttl: AI_CACHE_TTL,
      success: true,
    })
  } catch (error) {
    logError({ error, context: 'ai_cache_set', additionalInfo: { key } })
  }
}
