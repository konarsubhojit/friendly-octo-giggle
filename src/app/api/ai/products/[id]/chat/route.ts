import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, handleApiError } from '@/lib/api-utils'
import { logError } from '@/lib/logger'
import { buildCommerceContext } from '@/features/ai/services/chat-commerce-context'
import { runChatEngine } from '@/features/ai/services/chat-engine'
import { buildSystemPrompt } from '@/features/ai/services/chat-prompt'
import { assistantToolRegistry } from '@/features/ai/services/chat-tools'

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  let productId: string | undefined

  try {
    const { id } = await params
    productId = id
    const product = await db.products.findById(id)
    if (!product) return apiError('Product not found', 404)

    return await runChatEngine({
      request,
      surface: `product:${id}`,
      anchorProductId: id,
      toolRegistry: assistantToolRegistry,
      systemPrompt: async ({
        currencyCode,
        formatPrice,
        identity,
        intents,
        lastUserText,
      }) => {
        const supplementalContext = await buildCommerceContext({
          product,
          userId: identity.userId,
          isAuthenticated: identity.isAuthenticated,
          messageText: lastUserText,
          currencyCode,
          formatPrice,
          intents,
        })

        return buildSystemPrompt(
          product,
          currencyCode,
          formatPrice,
          supplementalContext
        )
      },
    })
  } catch (error) {
    logError({
      error,
      context: 'ai_product_chat',
      additionalInfo: { productId },
    })
    return handleApiError(error)
  }
}
