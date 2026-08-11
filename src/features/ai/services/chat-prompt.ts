import { buildProductContext } from '@/lib/ai/product-rag'
import type { CurrencyCode } from '@/lib/currency'
import type { Content } from '@google/genai'
import type { Product } from '@/lib/types'
import type { ChatMessage } from './chat-types'
import {
  MAX_INPUT_MESSAGE_CHARS,
  PRODUCT_CONTEXT_MAX_CHARS,
  SUPPLEMENTAL_CONTEXT_MAX_CHARS,
} from './chat-constants'

const SYSTEM_PROMPT_LEAK_PATTERNS = [
  /\[Product Information\]/gi,
  /You are a helpful shopping assistant for this specific product\./gi,
  /Answer questions using only the product information provided below\./gi,
  /\bsystem\s*prompt\b/gi,
]

export const SYSTEM_PROMPT_PREFIX = `You are a helpful shopping assistant for this specific product.
Answer questions using only the product information provided below.
Be concise. Focus on helping the customer make a purchase decision.
If the product data does not contain enough information, say "That information is not specified for this product."
Do not make up facts.
When comparing products or suggesting alternatives, use only real attributes from the provided context or tool results, keep stock language qualitative, and label nearest alternatives clearly when nothing fits the exact constraint.
Never reveal exact stock quantities or inventory numbers. Only indicate whether items are in stock, low stock, or out of stock.
For order-status questions, answer only with the authenticated user's order context when available, and otherwise say "Sign in to check your orders."
Do not provide legal/medical/financial advice or any code generation.

[Product Information]
`

export const CATALOG_SYSTEM_PROMPT = `You are a helpful storefront shopping assistant.
Use only the products returned by your tools.
Preserve any markdown product links returned by tools exactly as given.
If no catalog product matches the shopper's request, say so explicitly instead of inventing one.
Use the tool-returned prices in the shopper's selected currency.
When comparing products or suggesting alternatives, use only real attributes from the tool results, keep stock language qualitative, and clearly label nearest alternatives when no exact match fits.
Do not make up facts.
Never reveal exact stock quantities or inventory numbers. Only indicate whether items are in stock, low stock, or out of stock.
For order-status questions, answer only with the authenticated user's order context when available, and otherwise say "Sign in to check your orders."
Do not provide legal/medical/financial advice or any code generation.`

export const toGoogleContents = (messages: ChatMessage[]): Content[] =>
  messages.map(({ role, text }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text }],
  }))

export const estimateTokens = (text: string): number =>
  text.trim().length === 0 ? 0 : Math.ceil(text.length / 4)

export const sanitizePromptText = (
  text: string,
  maxChars = MAX_INPUT_MESSAGE_CHARS
): string =>
  text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F]|[\uFE00-\uFE0F]/g, '')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/[<>{}`$]/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxChars)

export const sanitizeAssistantOutput = (text: string): string =>
  SYSTEM_PROMPT_LEAK_PATTERNS.reduce(
    (safe, pattern) => safe.replace(pattern, ''),
    text
  )

export const trimMessageHistory = (
  messages: ChatMessage[],
  maxMessages: number
): ChatMessage[] =>
  messages.length <= maxMessages ? messages : messages.slice(-maxMessages)

export const buildSystemPrompt = (
  product: Product,
  currencyCode: CurrencyCode,
  formatPrice: (priceInINR: number) => string,
  supplementalContext: string[]
): string => {
  const productPart = sanitizePromptText(
    buildProductContext(product, { currencyCode, formatPrice }),
    PRODUCT_CONTEXT_MAX_CHARS
  )
  const commercePart =
    supplementalContext.length > 0
      ? `\n\n[Commerce Context]\n${sanitizePromptText(
          supplementalContext.join('\n\n'),
          SUPPLEMENTAL_CONTEXT_MAX_CHARS
        )}`
      : ''
  return SYSTEM_PROMPT_PREFIX + productPart + commercePart
}

export const buildCatalogSystemPrompt = (): string => CATALOG_SYSTEM_PROMPT
