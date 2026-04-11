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

const SYSTEM_PROMPT_PREFIX = `You are a helpful shopping assistant for this specific product.
Answer questions using only the product information provided below.
Be concise. Focus on helping the customer make a purchase decision.
If the product data does not contain enough information, say "That information is not specified for this product."
Do not make up facts. Do not discuss other products.

[Product Information]
`

const toGoogleContents = (messages: ChatMessage[]): Content[] =>
  messages.map(({ role, text }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text }],
  }))

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
    if (aiConfig.enabled === false) {
      return apiError('AI features are currently unavailable', 503)
    }
    chatModel = aiConfig.chatModel

    const systemPrompt =
      SYSTEM_PROMPT_PREFIX +
      buildProductContext(product, {
        currencyCode,
        formatPrice: (priceInINR: number) =>
          formatPriceForCurrency(priceInINR, currencyCode),
      })

    const trimmed = parsed.data.messages.slice(-aiConfig.maxHistoryMessages)
    const isSingleTurn = trimmed.length === 1
    const lastUserText = trimmed.findLast((m) => m.role === 'user')?.text ?? ''

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

    const contents = toGoogleContents(trimmed)
    const generateConfig = buildGenerateConfig(aiConfig, systemPrompt)
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
            const text = chunk.text
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
