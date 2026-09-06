import { logBusinessEvent } from '@/lib/logger'
import type { AssistantSurface, ChatMessage, DailyUsage } from './chat-types'
import {
  estimateTokens,
  sanitizeAssistantOutput,
  trimMessageHistory,
} from './chat-prompt'
import { persistMessages } from './chat-history'
import { recordDailyUsage } from './chat-usage'

export type CachedAnswerContext = {
  surface: AssistantSurface
  userId: string
  trimmed: ChatMessage[]
  estimatedInputTokens: number
  dailyUsage: DailyUsage
  threadId: string
  persistHistory: boolean
  maxHistoryMessages: number
  chatModel: string
}

/**
 * Records usage, emits analytics and persists history for a cache-hit answer.
 */
export const finalizeCachedAnswer = async (
  cached: string,
  ctx: CachedAnswerContext
): Promise<void> => {
  const outputTokens = estimateTokens(cached)
  const totalTokens = ctx.estimatedInputTokens + outputTokens
  await recordDailyUsage(ctx.userId, totalTokens)

  logBusinessEvent({
    event: 'ai_chat_request',
    details: {
      surface: ctx.surface,
      chatModel: ctx.chatModel,
      messageCount: ctx.trimmed.length,
      cached: true,
    },
    success: true,
  })
  logBusinessEvent({
    event: 'ai_chat_usage',
    userId: ctx.userId,
    details: {
      surface: ctx.surface,
      cached: true,
      inputTokens: ctx.estimatedInputTokens,
      outputTokens,
      totalTokens,
      requestsUsed: ctx.dailyUsage.requests + 1,
    },
    success: true,
  })

  if (ctx.persistHistory) {
    const historyToPersist = trimMessageHistory(
      [
        ...ctx.trimmed,
        { role: 'assistant', text: sanitizeAssistantOutput(cached) },
      ],
      ctx.maxHistoryMessages
    )
    await persistMessages(
      ctx.userId,
      ctx.surface,
      ctx.threadId,
      historyToPersist
    )
  }
}
