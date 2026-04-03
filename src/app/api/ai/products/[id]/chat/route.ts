import { NextRequest } from 'next/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { z } from 'zod'
import { getChatModel, getAiConfigCached } from '@/lib/ai/gateway'
import { buildProductContext } from '@/lib/ai/product-rag'
import { db } from '@/lib/db'
import { apiError, handleApiError } from '@/lib/api-utils'
import { logError, logBusinessEvent } from '@/lib/logger'

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

    const aiConfig = await getAiConfigCached()
    chatModel = aiConfig.chatModel
    const model = getChatModel(aiConfig.chatModel)
    const systemPrompt = SYSTEM_PROMPT_PREFIX + buildProductContext(product)

    const trimmed = parsed.data.messages.slice(
      -aiConfig.maxHistoryMessages
    ) as UIMessage[]
    const messages = await convertToModelMessages(trimmed)

    const messageCount = trimmed.length

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      maxOutputTokens: aiConfig.maxResponseTokens,
      abortSignal: request.signal,
    })

    logBusinessEvent({
      event: 'ai_chat_request',
      details: { productId: id, chatModel: aiConfig.chatModel, messageCount },
      success: true,
    })

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
