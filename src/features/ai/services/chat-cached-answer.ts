import { logBusinessEvent } from '@/lib/logger'
import type { ChatMessage, DailyUsage } from './chat-types'
import {
  estimateTokens,
  sanitizeAssistantOutput,
  trimMessageHistory,
} from './chat-prompt'
import { persistMessages } from './chat-history'
import { recordDailyUsage } from './chat-usage'

export type CachedAnswerContext = {
  productId: string
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
      productId: ctx.productId,
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
      productId: ctx.productId,
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
      ctx.productId,
      ctx.threadId,
      historyToPersist
    )
  }
}
