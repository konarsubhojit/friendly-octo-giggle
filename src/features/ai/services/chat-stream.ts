import { waitUntil } from '@vercel/functions'
import { setCachedAiResponse } from '@/lib/ai/ai-cache'
import { logError, logBusinessEvent } from '@/lib/logger'
import type { CurrencyCode } from '@/lib/currency'
import type {
  AssistantSurface,
  ChatMessage,
  DailyUsage,
} from './chat-types'
import {
  estimateTokens,
  sanitizeAssistantOutput,
  trimMessageHistory,
} from './chat-prompt'
import { persistMessages } from './chat-history'
import { adjustDailyTokenUsage } from './chat-usage'

/**
 * Wraps the model stream in a ReadableStream, sanitizing each chunk and
 * resolving the accumulated text for background side effects.
 */
export const buildStreamReader = (
  stream: AsyncIterable<{ text?: string }>
): {
  readable: ReadableStream<Uint8Array>
  fullTextPromise: Promise<string>
} => {
  const encoder = new TextEncoder()
  let resolveFull!: (text: string) => void
  const fullTextPromise = new Promise<string>((resolve) => {
    resolveFull = resolve
  })

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = ''
      try {
        for await (const chunk of stream) {
          const text = sanitizeAssistantOutput(chunk.text ?? '')
          if (text) {
            fullText += text
            controller.enqueue(encoder.encode(text))
          }
        }
        controller.close()
        resolveFull(fullText)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          controller.close()
          resolveFull('')
        } else {
          controller.error(error)
          resolveFull('')
        }
      }
    },
  })

  return { readable, fullTextPromise }
}

export type StreamSideEffectContext = {
  fullTextPromise: Promise<string>
  surface: AssistantSurface
  userId: string
  lastUserText: string
  currencyCode: CurrencyCode
  isSingleTurn: boolean
  persistHistory: boolean
  threadId: string
  trimmed: ChatMessage[]
  estimatedInputTokens: number
  reservedTotalTokens: number
  dailyUsage: DailyUsage
  maxHistoryMessages: number
}

export const scheduleStreamSideEffects = (
  ctx: StreamSideEffectContext
): void => {
  waitUntil(
    ctx.fullTextPromise
      .then(async (text) => {
        const outputTokens = estimateTokens(text)
        const totalTokens = ctx.estimatedInputTokens + outputTokens
        await adjustDailyTokenUsage(
          ctx.userId,
          totalTokens - ctx.reservedTotalTokens
        )
        logBusinessEvent({
          event: 'ai_chat_usage',
          userId: ctx.userId,
          details: {
            surface: ctx.surface,
            cached: false,
            inputTokens: ctx.estimatedInputTokens,
            outputTokens,
            totalTokens,
            requestsUsed: ctx.dailyUsage.requests + 1,
          },
          success: true,
        })
      })
      .catch((error) =>
        logError({
          error,
          context: 'ai_chat_usage_log',
          additionalInfo: { surface: ctx.surface, userId: ctx.userId },
        })
      )
  )

  if (ctx.isSingleTurn && ctx.lastUserText) {
    waitUntil(
      ctx.fullTextPromise
        .then((text) => {
          if (text)
            return setCachedAiResponse(
              ctx.surface,
              ctx.lastUserText,
              ctx.currencyCode,
              text
            )
        })
        .catch((error) =>
          logError({
            error,
            context: 'ai_cache_background_write',
            additionalInfo: { surface: ctx.surface },
          })
        )
    )
  }

  if (ctx.persistHistory) {
    waitUntil(
      ctx.fullTextPromise
        .then((text) => {
          const historyToPersist = trimMessageHistory(
            [...ctx.trimmed, { role: 'assistant', text }],
            ctx.maxHistoryMessages
          )
          return persistMessages(
            ctx.userId,
            ctx.surface,
            ctx.threadId,
            historyToPersist
          )
        })
        .catch((error) =>
          logError({
            error,
            context: 'ai_chat_history_persist',
            additionalInfo: {
              surface: ctx.surface,
              userId: ctx.userId,
              threadId: ctx.threadId,
            },
          })
        )
    )
  }
}
