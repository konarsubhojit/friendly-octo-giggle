import { z } from 'zod'
import type { CurrencyCode } from '@/lib/currency'

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  persistHistory: z.boolean().optional(),
  // Allow lightweight client-generated IDs (default shape: product-{productId}).
  threadId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9:_-]+$/)
    .optional(),
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ChatRequestData = z.infer<typeof ChatRequestSchema>

export type IntentSignals = {
  wantsComparison: boolean
  wantsRecommendation: boolean
  wantsDeliveryInfo: boolean
  wantsOrderStatus: boolean
  wantsReviewSummary: boolean
}

export type DailyUsage = { requests: number; tokens: number }

export type RequestIdentity = {
  userId: string
  isAuthenticated: boolean
}

export type AssistantSurface = `product:${string}` | 'catalog'

export type AssistantToolName =
  | 'search_catalog'
  | 'get_product_details'
  | 'compare_products'
  | 'get_order_status'

export type ToolExecutionContext = {
  identity: RequestIdentity
  currencyCode: CurrencyCode
  formatPrice: (priceInINR: number) => string
  anchorProductId?: string
}

export type AssistantTool<Args> = {
  name: AssistantToolName
  description: string
  argsSchema: z.ZodType<Args>
  requiresAuth: boolean
  execute: (args: Args, ctx: ToolExecutionContext) => Promise<string>
}
