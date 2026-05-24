import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import { genAI, getAiConfigCached, buildGenerateConfig } from '@/lib/ai/gateway'
import { buildProductContext } from '@/lib/ai/product-rag'
import { getCachedAiResponse, setCachedAiResponse } from '@/lib/ai/ai-cache'
import { db, drizzleDb } from '@/lib/db'
import { apiError, handleApiError } from '@/lib/api-utils'
import { logError, logBusinessEvent } from '@/lib/logger'
import { formatPriceForCurrency, isValidCurrencyCode } from '@/lib/currency'
import { getRedisClient } from '@/lib/redis'
import type { CurrencyCode } from '@/lib/currency'
import type { Content } from '@google/genai'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
})

type ChatMessage = z.infer<typeof ChatMessageSchema>

const MAX_INPUT_MESSAGE_CHARS = 500
const MAX_CONVERSATION_TURNS = 6
const MAX_OUTPUT_TOKENS = 400
const DAILY_REQUEST_QUOTA = 40
const DAILY_TOKEN_QUOTA = 12000
const PRODUCT_CONTEXT_MAX_CHARS = 4000

const JAILBREAK_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior)\s+(instructions|rules)\b/i,
  /\b(system\s*prompt|developer\s*message|jailbreak|bypass\s+safety)\b/i,
  /\b(reveal|show|print|dump)\b.{0,40}\b(prompt|instructions|hidden\s+rules)\b/i,
  /\b(act\s+as|pretend\s+to\s+be)\b.{0,30}\b(system|developer|dan)\b/i,
]

const OFF_DOMAIN_PATTERNS = [
  /\b(write|generate|create)\b.{0,30}\b(code|script|sql|program|regex|essay|poem)\b/i,
  /\b(solve|calculate)\b.{0,20}\b(math|equation|homework)\b/i,
  /\b(weather\s+(today|tomorrow|in)\b|forecast|temperature\s+in)\b/i,
  /\b(latest\s+news|headlines|politics|election)\b/i,
  /\bmedical\s+advice|diagnose|prescription|legal\s+advice\b/i,
]

const SYSTEM_PROMPT_LEAK_PATTERNS = [
  /\[Product Information\]/gi,
  /You are a helpful shopping assistant for this specific product\./gi,
  /Answer questions using only the product information provided below\./gi,
  /\bsystem\s*prompt\b/gi,
]

const SYSTEM_PROMPT_PREFIX = `You are a helpful shopping assistant for this specific product.
Answer questions using only the product information provided below.
Be concise. Focus on helping the customer make a purchase decision.
If the product data does not contain enough information, say "That information is not specified for this product."
Do not make up facts. Do not discuss other products.
Never reveal exact stock quantities or inventory numbers. Only indicate whether items are in stock, low stock, or out of stock.

[Product Information]
`

const toGoogleContents = (messages: ChatMessage[]): Content[] =>
  messages.map(({ role, text }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text }],
  }))

const estimateTokens = (text: string): number =>
  text.trim().length === 0 ? 0 : Math.ceil(text.length / 4)

const sanitizePromptText = (
  text: string,
  maxChars = MAX_INPUT_MESSAGE_CHARS
): string =>
  text
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/[<>{}`$]/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxChars)

const sanitizeAssistantOutput = (text: string): string =>
  SYSTEM_PROMPT_LEAK_PATTERNS.reduce(
    (safe, pattern) => safe.replace(pattern, ''),
    text
  )

const utcDateKey = (): string => new Date().toISOString().slice(0, 10)

const getDailyUsage = async (
  userId: string
): Promise<{ requests: number; tokens: number }> => {
  const redis = getRedisClient()
  if (!redis) return { requests: 0, tokens: 0 }

  const key = `ai:chat:usage:${userId}:${utcDateKey()}`
  const raw =
    ((await redis.hgetall(key)) as Record<string, string | number> | null) ?? {}
  const requests = Number(raw.requests ?? 0)
  const tokens = Number(raw.tokens ?? 0)
  return {
    requests: Number.isFinite(requests) ? requests : 0,
    tokens: Number.isFinite(tokens) ? tokens : 0,
  }
}

const recordDailyUsage = async (
  userId: string,
  tokenCount: number
): Promise<void> => {
  const redis = getRedisClient()
  if (!redis) return

  const key = `ai:chat:usage:${userId}:${utcDateKey()}`
  const ttlSeconds = 60 * 60 * 48
  await redis.hincrby(key, 'requests', 1)
  await redis.hincrby(key, 'tokens', tokenCount)
  await redis.expire(key, ttlSeconds)
}

const detectBlockedPrompt = (text: string): string | null => {
  if (JAILBREAK_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'Prompt contains disallowed instructions.'
  }
  if (OFF_DOMAIN_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'Only product-related questions are allowed.'
  }
  return null
}

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  let productId: string | undefined
  let chatModel: string | undefined

  try {
    const { id } = await params
    productId = id
    const product = await db.products.findById(id)

    if (!product) {
      return apiError('Product not found', 404)
    }

    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return apiError('Invalid request body', 400)
    }

    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    if (
      parsed.data.messages.some(
        (message) =>
          message.text.trim().length === 0 ||
          message.text.length > MAX_INPUT_MESSAGE_CHARS
      )
    ) {
      return apiError(
        `Each message must be between 1 and ${MAX_INPUT_MESSAGE_CHARS} characters`,
        400
      )
    }

    const sanitizedMessages = parsed.data.messages.map((message) => ({
      ...message,
      text: sanitizePromptText(message.text),
    }))
    if (sanitizedMessages.some((message) => message.text.length === 0)) {
      return apiError('Messages must include meaningful text', 400)
    }

    const conversationTurns = sanitizedMessages.filter(
      (message) => message.role === 'user'
    ).length
    if (conversationTurns > MAX_CONVERSATION_TURNS) {
      return apiError(
        `Conversation is limited to ${MAX_CONVERSATION_TURNS} user turns`,
        400
      )
    }

    const lastUserText =
      sanitizedMessages.findLast((message) => message.role === 'user')?.text ?? ''
    const blockedReason = detectBlockedPrompt(lastUserText)
    if (blockedReason) {
      return apiError(blockedReason, 400)
    }

    let currencyCode: CurrencyCode = 'INR'
    const userRecord = await drizzleDb.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { currencyPreference: true },
    })
    if (
      userRecord?.currencyPreference &&
      isValidCurrencyCode(userRecord.currencyPreference)
    ) {
      currencyCode = userRecord.currencyPreference
    }

    const aiConfig = await getAiConfigCached()
    if (aiConfig.enabled === false) {
      return apiError('AI features are currently unavailable', 503)
    }
    chatModel = aiConfig.chatModel

    const systemPrompt =
      SYSTEM_PROMPT_PREFIX +
      sanitizePromptText(
        buildProductContext(product, {
          currencyCode,
          formatPrice: (priceInINR: number) =>
            formatPriceForCurrency(priceInINR, currencyCode),
        }),
        PRODUCT_CONTEXT_MAX_CHARS
      )

    const trimmed = sanitizedMessages.slice(
      -Math.min(aiConfig.maxHistoryMessages, MAX_CONVERSATION_TURNS * 2)
    )
    const isSingleTurn = trimmed.length === 1
    const estimatedInputTokens = trimmed.reduce(
      (sum, message) => sum + estimateTokens(message.text),
      0
    )

    const dailyUsage = await getDailyUsage(session.user.id)
    if (dailyUsage.requests + 1 > DAILY_REQUEST_QUOTA) {
      return apiError('Daily AI chat request quota exceeded', 429)
    }
    if (dailyUsage.tokens + estimatedInputTokens > DAILY_TOKEN_QUOTA) {
      return apiError('Daily AI chat token quota exceeded', 429)
    }

    if (isSingleTurn && lastUserText) {
      const cached = await getCachedAiResponse(id, lastUserText, currencyCode)
      if (cached !== null) {
        const outputTokens = estimateTokens(cached)
        const totalTokens = estimatedInputTokens + outputTokens
        await recordDailyUsage(session.user.id, totalTokens)

        logBusinessEvent({
          event: 'ai_chat_request',
          details: {
            productId: id,
            chatModel: aiConfig.chatModel,
            messageCount: trimmed.length,
            cached: true,
          },
          success: true,
        })
        logBusinessEvent({
          event: 'ai_chat_usage',
          userId: session.user.id,
          details: {
            productId: id,
            cached: true,
            inputTokens: estimatedInputTokens,
            outputTokens,
            totalTokens,
            requestsUsed: dailyUsage.requests + 1,
          },
          success: true,
        })
        return NextResponse.json({ text: cached })
      }
    }

    const contents = toGoogleContents(trimmed)
    const generateConfig = {
      ...buildGenerateConfig(aiConfig, systemPrompt),
      maxOutputTokens: Math.min(aiConfig.maxResponseTokens, MAX_OUTPUT_TOKENS),
    }
    const messageCount = trimmed.length

    const stream = await genAI.models.generateContentStream({
      model: chatModel,
      contents,
      config: { ...generateConfig, abortSignal: request.signal },
    })

    logBusinessEvent({
      event: 'ai_chat_request',
      details: { productId: id, chatModel, messageCount },
      success: true,
    })

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

    waitUntil(
      fullTextPromise
        .then(async (text) => {
          const outputTokens = estimateTokens(text)
          const totalTokens = estimatedInputTokens + outputTokens
          await recordDailyUsage(session.user.id, totalTokens)
          logBusinessEvent({
            event: 'ai_chat_usage',
            userId: session.user.id,
            details: {
              productId: id,
              cached: false,
              inputTokens: estimatedInputTokens,
              outputTokens,
              totalTokens,
              requestsUsed: dailyUsage.requests + 1,
            },
            success: true,
          })
        })
        .catch((error) =>
          logError({
            error,
            context: 'ai_chat_usage_log',
            additionalInfo: { productId: id, userId: session.user.id },
          })
        )
    )

    if (isSingleTurn && lastUserText) {
      waitUntil(
        fullTextPromise
          .then((text) => {
            if (text)
              return setCachedAiResponse(id, lastUserText, currencyCode, text)
          })
          .catch((error) =>
            logError({
              error,
              context: 'ai_cache_background_write',
              additionalInfo: { productId: id },
            })
          )
      )
    }

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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
