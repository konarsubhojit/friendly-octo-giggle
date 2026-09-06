import { z } from 'zod'
import { getRedisClient } from '@/lib/redis'
import { logError } from '@/lib/logger'
import {
  ChatMessageSchema,
  type AssistantSurface,
  type ChatMessage,
  type RequestIdentity,
} from './chat-types'
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
  surface: AssistantSurface,
  identity: RequestIdentity
): string => {
  if (providedThreadId) return providedThreadId
  if (surface === 'catalog') {
    return identity.isAuthenticated
      ? 'catalog-user-scoped-default'
      : 'catalog-guest-scoped-default'
  }
  return `product-${surface.slice('product:'.length)}`
}

export const getChatHistoryKey = (
  userId: string,
  surface: AssistantSurface,
  threadId: string
): string => `ai:chat:history:${userId}:${surface}:${threadId}`

export const loadPersistedMessages = async (
  userId: string,
  surface: AssistantSurface,
  threadId: string
): Promise<ChatMessage[]> => {
  const redis = getRedisClient() as RedisHistoryClient | null
  if (!redis?.get) return []

  try {
    const raw = await redis.get(getChatHistoryKey(userId, surface, threadId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const result = z.array(ChatMessageSchema).safeParse(parsed)
    return result.success ? result.data : []
  } catch (error) {
    logError({
      error,
      context: 'ai_chat_history_load',
      additionalInfo: { userId, surface, threadId },
    })
    return []
  }
}

export const persistMessages = async (
  userId: string,
  surface: AssistantSurface,
  threadId: string,
  messages: ChatMessage[]
): Promise<void> => {
  const redis = getRedisClient() as RedisHistoryClient | null
  if (!redis?.set) return

  await redis.set(
    getChatHistoryKey(userId, surface, threadId),
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
  surface: AssistantSurface,
  threadId: string,
  maxMessages: number
): Promise<ChatMessage[]> => {
  if (!persistHistory || sanitizedMessages.length !== 1) {
    return sanitizedMessages
  }
  const persisted = await loadPersistedMessages(userId, surface, threadId)
  if (persisted.length === 0) return sanitizedMessages
  return trimMessageHistory([...persisted, ...sanitizedMessages], maxMessages)
}
