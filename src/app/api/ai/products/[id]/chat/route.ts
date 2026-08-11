import { NextRequest, NextResponse } from 'next/server'
import { genAI, getAiConfigCached, buildGenerateConfig } from '@/lib/ai/gateway'
import { getCachedAiResponse } from '@/lib/ai/ai-cache'
import { db } from '@/lib/db'
import { apiError, handleApiError } from '@/lib/api-utils'
import { logError, logBusinessEvent } from '@/lib/logger'
import { formatPriceForCurrency } from '@/lib/currency'
import {
  ADVANCED_DAILY_REQUEST_QUOTA,
  DAILY_REQUEST_QUOTA,
  DAILY_TOKEN_QUOTA,
  MAX_CONVERSATION_TURNS,
  MAX_OUTPUT_TOKENS,
} from '@/features/ai/services/chat-constants'
import {
  parseAndValidateRequest,
  resolveCurrencyForUser,
} from '@/features/ai/services/chat-request'
import { composeConversationMessages } from '@/features/ai/services/chat-history'
import {
  detectBlockedPrompt,
  detectIntentSignals,
  usesAnyAdvancedIntent,
} from '@/features/ai/services/chat-intent'
import { buildCommerceContext } from '@/features/ai/services/chat-commerce-context'
import {
  buildSystemPrompt,
  estimateTokens,
  toGoogleContents,
} from '@/features/ai/services/chat-prompt'
import {
  enforceQuotas,
  getDailyUsage,
  recordDailyUsage,
} from '@/features/ai/services/chat-usage'
import { finalizeCachedAnswer } from '@/features/ai/services/chat-cached-answer'
import {
  buildStreamReader,
  scheduleStreamSideEffects,
} from '@/features/ai/services/chat-stream'

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  let productId: string | undefined
  let chatModel: string | undefined

  try {
    const { id } = await params
    productId = id
    const surface = `product:${id}` as const
    const product = await db.products.findById(id)
    if (!product) return apiError('Product not found', 404)

    const prepared = await parseAndValidateRequest(request, id)
    if (!prepared.ok) return apiError(prepared.error, 400)

    const { identity, persistHistory, threadId, sanitizedMessages } =
      prepared.prepared
    const { userId, isAuthenticated } = identity

    const allMessages = await composeConversationMessages(
      sanitizedMessages,
      persistHistory,
      userId,
      surface,
      threadId,
      MAX_CONVERSATION_TURNS * 2
    )

    const conversationTurns = allMessages.filter(
      (message) => message.role === 'user'
    ).length
    if (conversationTurns > MAX_CONVERSATION_TURNS) {
      return apiError(
        `Conversation is limited to ${MAX_CONVERSATION_TURNS} user turns`,
        400
      )
    }

    const lastUserText =
      allMessages.findLast((message) => message.role === 'user')?.text ?? ''
    const blockedReason = detectBlockedPrompt(lastUserText)
    if (blockedReason) return apiError(blockedReason, 400)

    const intents = detectIntentSignals(lastUserText)
    const usesAdvancedFeatures = usesAnyAdvancedIntent(intents)
    const currencyCode = isAuthenticated
      ? await resolveCurrencyForUser(userId)
      : 'INR'

    const aiConfig = await getAiConfigCached()
    if (aiConfig.enabled === false) {
      return apiError('AI features are currently unavailable', 503)
    }
    if (usesAdvancedFeatures && aiConfig.advancedFeaturesEnabled === false) {
      return apiError('Advanced AI features are currently unavailable', 503)
    }
    chatModel = aiConfig.chatModel

    const formatPrice = (priceInINR: number) =>
      formatPriceForCurrency(priceInINR, currencyCode)
    const supplementalContext = await buildCommerceContext({
      product,
      userId,
      isAuthenticated,
      messageText: lastUserText,
      currencyCode,
      formatPrice,
      intents,
    })

    const systemPrompt = buildSystemPrompt(
      product,
      currencyCode,
      formatPrice,
      supplementalContext
    )

    const trimmed = allMessages.slice(
      -Math.min(aiConfig.maxHistoryMessages, MAX_CONVERSATION_TURNS * 2)
    )
    const isSingleTurn = trimmed.length === 1
    const estimatedInputTokens = trimmed.reduce(
      (sum, message) => sum + estimateTokens(message.text),
      0
    )
    const reservedTotalTokens = estimatedInputTokens + MAX_OUTPUT_TOKENS

    const dailyUsage = await getDailyUsage(userId)
    const quotaError = await enforceQuotas({
      userId,
      dailyUsage,
      reservedTotalTokens,
      requestQuota: aiConfig.dailyRequestQuota ?? DAILY_REQUEST_QUOTA,
      tokenQuota: aiConfig.dailyTokenQuota ?? DAILY_TOKEN_QUOTA,
      usesAdvancedFeatures,
      advancedQuota:
        aiConfig.advancedFeatureDailyRequestQuota ??
        ADVANCED_DAILY_REQUEST_QUOTA,
    })
    if (quotaError) return apiError(quotaError, 429)

    if (isSingleTurn && lastUserText) {
      const cached = await getCachedAiResponse(
        surface,
        lastUserText,
        currencyCode
      )
      if (cached !== null) {
        await finalizeCachedAnswer(cached, {
          surface,
          userId,
          trimmed,
          estimatedInputTokens,
          dailyUsage,
          threadId,
          persistHistory,
          maxHistoryMessages: aiConfig.maxHistoryMessages,
          chatModel: aiConfig.chatModel,
        })
        return NextResponse.json(
          { text: cached, threadId: persistHistory ? threadId : undefined },
          persistHistory
            ? { headers: { 'X-AI-Thread-ID': threadId } }
            : undefined
        )
      }
    }

    const generateConfig = {
      ...buildGenerateConfig(aiConfig, systemPrompt),
      maxOutputTokens: Math.min(aiConfig.maxResponseTokens, MAX_OUTPUT_TOKENS),
    }

    await recordDailyUsage(userId, reservedTotalTokens)

    const stream = await genAI.models.generateContentStream({
      model: chatModel,
      contents: toGoogleContents(trimmed),
      config: { ...generateConfig, abortSignal: request.signal },
    })

    logBusinessEvent({
      event: 'ai_chat_request',
      details: { productId: id, chatModel, messageCount: trimmed.length },
      success: true,
    })

    const { readable, fullTextPromise } = buildStreamReader(stream)

    scheduleStreamSideEffects({
      fullTextPromise,
      surface,
      userId,
      lastUserText,
      currencyCode,
      isSingleTurn,
      persistHistory,
      threadId,
      trimmed,
      estimatedInputTokens,
      reservedTotalTokens,
      dailyUsage,
      maxHistoryMessages: aiConfig.maxHistoryMessages,
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
        ...(persistHistory ? { 'X-AI-Thread-ID': threadId } : {}),
      },
    })
  } catch (error) {
    logError({
      error,
      context: 'ai_product_chat',
      additionalInfo: { productId, chatModel },
    })
    return handleApiError(error)
  }
}
