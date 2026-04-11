import { NextRequest, NextResponse } from 'next/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import { getChatModel, getAiConfigCached, getProviderOptions } from '@/lib/ai/gateway'
import { buildProductContext } from '@/lib/ai/product-rag'
import { getCachedAiResponse, setCachedAiResponse } from '@/lib/ai/ai-cache'
import { db, drizzleDb } from '@/lib/db'
import { apiError, handleApiError } from '@/lib/api-utils'
import { logError, logBusinessEvent } from '@/lib/logger'
import { formatPriceForCurrency, isValidCurrencyCode } from '@/lib/currency'
import type { CurrencyCode } from '@/lib/currency'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system']),
      parts: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        })
      ),
    })
  ),
})

const SYSTEM_PROMPT_PREFIX = `You are a helpful shopping assistant for this specific product.
Answer questions using only the product information provided below.
Be concise. Focus on helping the customer make a purchase decision.
If the product data does not contain enough information, say "That information is not specified for this product."
Do not make up facts. Do not discuss other products.

[Product Information]
`

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
    chatModel = aiConfig.chatModel
    const model = getChatModel(aiConfig.chatModel)
    const systemPrompt =
      SYSTEM_PROMPT_PREFIX +
      buildProductContext(product, {
        currencyCode,
        formatPrice: (priceInINR: number) =>
          formatPriceForCurrency(priceInINR, currencyCode),
      })

    const trimmed = parsed.data.messages.slice(
      -aiConfig.maxHistoryMessages
    ) as UIMessage[]

    // Only cache single-turn (context-free) requests — multi-turn responses
    // depend on conversation history and cannot be safely cached by question alone.
    const isSingleTurn = trimmed.length === 1
    const lastUserMessage = trimmed.findLast((m) => m.role === 'user')
    const lastUserText =
      lastUserMessage?.parts?.find((p) => p.type === 'text')?.text ?? ''

    // Check cache for single-turn questions
    if (isSingleTurn && lastUserText) {
      const cached = await getCachedAiResponse(id, lastUserText, currencyCode)
      if (cached !== null) {
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
        return NextResponse.json({ text: cached })
      }
    }

    const messages = await convertToModelMessages(trimmed)

    const messageCount = trimmed.length

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      maxOutputTokens: aiConfig.maxResponseTokens,
      abortSignal: request.signal,
      providerOptions: getProviderOptions(aiConfig),
    })

    logBusinessEvent({
      event: 'ai_chat_request',
      details: { productId: id, chatModel: aiConfig.chatModel, messageCount },
      success: true,
    })

    // Cache the final assembled text after streaming completes (single-turn only)
    if (isSingleTurn && lastUserText) {
      waitUntil(
        Promise.resolve(result.text)
          .then((text) =>
            setCachedAiResponse(id, lastUserText, currencyCode, text)
          )
          .catch((error) =>
            logError({
              error,
              context: 'ai_cache_background_write',
              additionalInfo: { productId: id },
            })
          )
      )
    }

    return result.toUIMessageStreamResponse()
  } catch (error) {
    logError({
      error,
      context: 'ai_product_chat',
      additionalInfo: { productId, chatModel },
    })
    return handleApiError(error)
  }
}
