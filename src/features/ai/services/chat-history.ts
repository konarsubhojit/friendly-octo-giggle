import { z } from 'zod'
import { getRedisClient } from '@/lib/redis'
import { logError } from '@/lib/logger'
import { ChatMessageSchema, type ChatMessage } from './chat-types'
import { CHAT_HISTORY_TTL_SECONDS } from './chat-constants'
import { trimMessageHistory } from './chat-prompt'

type RedisHistoryClient = {
  get?: (key: string) => Promise<string | null>
  set?: (
    key: string,
    value: string,
    options?: { ex?: number }
  ) => Promise<unknown>
}

export const resolveThreadId = (
  providedThreadId: string | undefined,
  productId: string
): string => providedThreadId ?? `product-${productId}`

export const getChatHistoryKey = (
  userId: string,
  productId: string,
  threadId: string
): string => `ai:chat:history:${userId}:${productId}:${threadId}`

export const loadPersistedMessages = async (
  userId: string,
  productId: string,
  threadId: string
): Promise<ChatMessage[]> => {
  const redis = getRedisClient() as RedisHistoryClient | null
  if (!redis?.get) return []

  try {
    const raw = await redis.get(getChatHistoryKey(userId, productId, threadId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const result = z.array(ChatMessageSchema).safeParse(parsed)
    return result.success ? result.data : []
  } catch (error) {
    logError({
      error,
      context: 'ai_chat_history_load',
      additionalInfo: { userId, productId, threadId },
    })
    return []
  }
}

export const persistMessages = async (
  userId: string,
  productId: string,
  threadId: string,
  messages: ChatMessage[]
): Promise<void> => {
  const redis = getRedisClient() as RedisHistoryClient | null
  if (!redis?.set) return

  await redis.set(
    getChatHistoryKey(userId, productId, threadId),
    JSON.stringify(messages),
    { ex: CHAT_HISTORY_TTL_SECONDS }
  )
}

/**
 * Merges persisted history into a fresh single-message request so multi-turn
 * context survives across client sessions.
 */
export const composeConversationMessages = async (
  sanitizedMessages: ChatMessage[],
  persistHistory: boolean,
  userId: string,
  productId: string,
  threadId: string,
  maxMessages: number
): Promise<ChatMessage[]> => {
  if (!persistHistory || sanitizedMessages.length !== 1) {
    return sanitizedMessages
  }
  const persisted = await loadPersistedMessages(userId, productId, threadId)
  if (persisted.length === 0) return sanitizedMessages
  return trimMessageHistory([...persisted, ...sanitizedMessages], maxMessages)
}
