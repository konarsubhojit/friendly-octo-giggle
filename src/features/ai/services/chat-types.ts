import { z } from 'zod'

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
