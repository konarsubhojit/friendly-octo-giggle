import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import { genAI, getAiConfigCached, buildGenerateConfig } from '@/lib/ai/gateway'
import { buildProductContext } from '@/lib/ai/product-rag'
import { getCachedAiResponse, setCachedAiResponse } from '@/lib/ai/ai-cache'
import { db, drizzleDb } from '@/lib/db'
import { apiError, handleApiError } from '@/lib/api-utils'
import { logError, logBusinessEvent } from '@/lib/logger'
import {
  convertPriceToINR,
  formatPriceForCurrency,
  isValidCurrencyCode,
} from '@/lib/currency'
import { getRedisClient } from '@/lib/redis'
import { getShippingConfig } from '@/lib/edge-config'
import {
  getVariantMinPrice,
  getVariantTotalStock,
} from '@/features/product/variant-utils'
import type { CurrencyCode } from '@/lib/currency'
import type { Content } from '@google/genai'
import type { Product } from '@/lib/types'
import type { Session } from 'next-auth'
import { users, products, orders, reviews } from '@/lib/schema'
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

const ChatRequestSchema = z.object({
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

type ChatMessage = z.infer<typeof ChatMessageSchema>

const MAX_INPUT_MESSAGE_CHARS = 500
const MAX_CONVERSATION_TURNS = 6
const MAX_OUTPUT_TOKENS = 400
const DAILY_REQUEST_QUOTA = 40
const DAILY_TOKEN_QUOTA = 12000
const ADVANCED_DAILY_REQUEST_QUOTA = 15
const PRODUCT_CONTEXT_MAX_CHARS = 4000
const SUPPLEMENTAL_CONTEXT_MAX_CHARS = 1600
const CHAT_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30
const MAX_REVIEW_COMMENT_CHARS = 120

const DELIVERY_INFO_PATTERNS = [
  /\b(delivery|deliver|shipping|arrive|eta|estimate)\b/i,
]

const RECOMMENDATION_PATTERNS = [
  /\b(recommend|suggest|best|good option|top pick)\b/i,
  /\b(under|below|less than)\b.{0,12}\b[$₹€£]?\s*\d+/i,
]

const COMPARISON_PATTERNS = [
  /\bcompare\b/i,
  /\b(vs|versus)\b/i,
  /\bdifference between\b/i,
]

const REVIEW_SUMMARY_PATTERNS = [
  /\b(review|reviews|rating|ratings|feedback|customers?\s+say)\b/i,
]

const ORDER_STATUS_PATTERNS = [
  /\bwhere\s+is\s+my\s+order\b/i,
  /\border\s+status\b/i,
  /\btrack(?:ing)?\s+my\s+order\b/i,
]

const BUDGET_PATTERN =
  /\b(?:under|below|less than|up to)\s*(?:([$₹€£])\s*)?(\d+(?:\.\d{1,2})?)\s*([$₹€£])?/i
const ORDER_ID_PATTERN = /\b[A-Za-z0-9]{7,10}\b/

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
Do not make up facts.
Never reveal exact stock quantities or inventory numbers. Only indicate whether items are in stock, low stock, or out of stock.
For order-status questions, answer only with the authenticated user's order context when available.
Do not provide legal/medical/financial advice or any code generation.

[Product Information]
`

const toGoogleContents = (messages: ChatMessage[]): Content[] =>
  messages.map(({ role, text }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text }],
  }))

const estimateTokens = (text: string): number =>
  text.trim().length === 0 ? 0 : Math.ceil(text.length / 4)

const normalizePolicyText = (
  text: string
): { normalized: string; compact: string } => {
  const normalized = text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F]|[\uFE00-\uFE0F]/g, '')
    .toLowerCase()
    .replace(/[013457]/g, (char) => {
      const map: Record<string, string> = {
        '0': 'o',
        '1': 'i',
        '3': 'e',
        '4': 'a',
        '5': 's',
        '7': 't',
      }
      return map[char] ?? char
    })
    .replace(/\s+/gu, ' ')
    .trim()
  return {
    normalized,
    compact: normalized.replace(/[^a-z]/g, ''),
  }
}

const sanitizePromptText = (
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

const sanitizeAssistantOutput = (text: string): string =>
  SYSTEM_PROMPT_LEAK_PATTERNS.reduce(
    (safe, pattern) => safe.replace(pattern, ''),
    text
  )

const toStockLabel = (stock: number): string => {
  if (stock > 5) return 'In Stock'
  if (stock > 0) return 'Low Stock'
  return 'Out of Stock'
}

type IntentSignals = {
  wantsComparison: boolean
  wantsRecommendation: boolean
  wantsDeliveryInfo: boolean
  wantsOrderStatus: boolean
  wantsReviewSummary: boolean
}

const detectIntentSignals = (text: string): IntentSignals => ({
  wantsComparison: COMPARISON_PATTERNS.some((pattern) => pattern.test(text)),
  wantsRecommendation: RECOMMENDATION_PATTERNS.some((pattern) =>
    pattern.test(text)
  ),
  wantsDeliveryInfo: DELIVERY_INFO_PATTERNS.some((pattern) =>
    pattern.test(text)
  ),
  wantsOrderStatus: ORDER_STATUS_PATTERNS.some((pattern) => pattern.test(text)),
  wantsReviewSummary: REVIEW_SUMMARY_PATTERNS.some((pattern) =>
    pattern.test(text)
  ),
})

const detectCurrencyFromSymbol = (
  symbol: string | undefined,
  fallbackCurrency: CurrencyCode
): CurrencyCode => {
  switch (symbol) {
    case '$':
      return 'USD'
    case '€':
      return 'EUR'
    case '£':
      return 'GBP'
    case '₹':
      return 'INR'
    default:
      return fallbackCurrency
  }
}

const parseBudgetInINR = (
  text: string,
  fallbackCurrency: CurrencyCode
): number | null => {
  const match = new RegExp(BUDGET_PATTERN).exec(text)
  if (!match) return null
  const raw = Number(match[2])
  if (!Number.isFinite(raw) || raw <= 0) return null

  const symbol = match[1] ?? match[3]
  const detectedCurrency = detectCurrencyFromSymbol(symbol, fallbackCurrency)

  return convertPriceToINR(raw, detectedCurrency)
}

const escapeLikeValue = (value: string): string =>
  value.replace(/[\\%_]/g, String.raw`\$&`)

const resolveThreadId = (
  providedThreadId: string | undefined,
  productId: string
): string => providedThreadId ?? `product-${productId}`

const getChatHistoryKey = (
  userId: string,
  productId: string,
  threadId: string
): string => `ai:chat:history:${userId}:${productId}:${threadId}`

type RedisHistoryClient = {
  get?: (key: string) => Promise<string | null>
  set?: (
    key: string,
    value: string,
    options?: { ex?: number }
  ) => Promise<unknown>
}

const trimMessageHistory = (
  messages: ChatMessage[],
  maxMessages: number
): ChatMessage[] => {
  if (messages.length <= maxMessages) return messages
  return messages.slice(-maxMessages)
}

const loadPersistedMessages = async (
  userId: string,
  productId: string,
  threadId: string
): Promise<ChatMessage[]> => {
  const redis = getRedisClient() as RedisHistoryClient | null
  if (!redis?.get) return []

  try {
    const raw = await redis.get(getChatHistoryKey(userId, productId, threadId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const result = z.array(ChatMessageSchema).safeParse(parsed)
    return result.success ? result.data : []
  } catch (error) {
    logError({
      error,
      context: 'ai_chat_history_load',
      additionalInfo: { userId, productId, threadId },
    })
    return []
  }
}

const persistMessages = async (
  userId: string,
  productId: string,
  threadId: string,
  messages: ChatMessage[]
): Promise<void> => {
  const redis = getRedisClient() as RedisHistoryClient | null
  if (!redis?.set) return

  await redis.set(
    getChatHistoryKey(userId, productId, threadId),
    JSON.stringify(messages),
    { ex: CHAT_HISTORY_TTL_SECONDS }
  )
}

const getAdvancedUsage = async (userId: string): Promise<number> => {
  const redis = getRedisClient()
  if (!redis) return 0
  const key = `ai:chat:advanced:${userId}:${utcDateKey()}`
  const raw =
    (await redis.hgetall(key)) ?? {}
  const requests = Number(raw.requests ?? 0)
  return Number.isFinite(requests) ? requests : 0
}
const recordAdvancedUsage = async (userId: string): Promise<void> => {
  const redis = getRedisClient()
  if (!redis) return
  const key = `ai:chat:advanced:${userId}:${utcDateKey()}`
  await redis.hincrby(key, 'requests', 1)
  await redis.expire(key, secondsUntilNextUtcMidnight())
}

const extractComparisonTerms = (
  text: string,
  productName: string
): string[] => {
  const normalized = text
    .replace(/\bcompare\b/gi, ' ')
    .replace(/\bdifference\s+between\b/gi, ' ')
  const terms = normalized
    .split(/\b(?:vs\.?|versus|and|with)\b/gi)
    .map((part) => part.replace(/[^\w\s-]/g, ' ').trim())
    .filter((part) => part.length >= 3)
    .slice(0, 3)

  if (terms.length > 0) return terms
  return [productName]
}

const fetchComparisonContext = async (
  currentProduct: Product,
  text: string,
  currencyCode: CurrencyCode,
  formatPrice: (priceInINR: number) => string
): Promise<string | null> => {
  const terms = extractComparisonTerms(text, currentProduct.name)
  const conditions = terms.map((term) =>
    ilike(products.name, `%${escapeLikeValue(term)}%`)
  )
  if (conditions.length === 0) return null

  const rows = await drizzleDb.query.products.findMany({
    where: and(isNull(products.deletedAt), or(...conditions)),
    with: {
      variants: {
        where: (variant, { isNull: isVariantNull }) =>
          isVariantNull(variant.deletedAt),
        columns: { price: true, stock: true },
      },
    },
    limit: 4,
  })

  if (rows.length <= 1) return null

  const lines = rows.map((row) =>
    formatComparableProduct(row.name, row.variants, currencyCode, formatPrice)
  )

  return `Comparison candidates:\n${lines.join('\n')}`
}

const fetchRecommendationContext = async (
  currentProduct: Product,
  text: string,
  currencyCode: CurrencyCode,
  formatPrice: (priceInINR: number) => string
): Promise<string | null> => {
  const budgetInINR = parseBudgetInINR(text, currencyCode)
  if (!budgetInINR) return null

  const rows = await drizzleDb.query.products.findMany({
    where: and(
      isNull(products.deletedAt),
      eq(products.category, currentProduct.category)
    ),
    with: {
      variants: {
        where: (variant, { isNull: isVariantNull }) =>
          isVariantNull(variant.deletedAt),
        columns: { price: true, stock: true },
      },
    },
    limit: 12,
  })

  const candidates = rows
    .filter((row) => row.id !== currentProduct.id)
    .map((row) => ({
      id: row.id,
      name: row.name,
      minPrice: getVariantMinPrice(row.variants),
      stock: getVariantTotalStock(row.variants),
    }))
    .filter((row) => row.minPrice > 0 && row.minPrice <= budgetInINR)
    .sort((a, b) => a.minPrice - b.minPrice)
    .slice(0, 3)

  if (candidates.length === 0) {
    return `No same-category alternatives were found under ${formatPrice(budgetInINR)} (${currencyCode}).`
  }

  return [
    `Recommendations under ${formatPrice(budgetInINR)} (${currencyCode}):`,
    ...candidates.map(
      (row) =>
        `- ${row.name}: ${formatPrice(row.minPrice)}, ${toStockLabel(row.stock)}`
    ),
  ].join('\n')
}

const formatComparableProduct = (
  name: string,
  variants: Array<{ price: number; stock: number }>,
  currencyCode: CurrencyCode,
  formatPrice: (priceInINR: number) => string
): string => {
  const minPrice = getVariantMinPrice(variants)
  const totalStock = getVariantTotalStock(variants)
  return `- ${name}: ${formatPrice(minPrice)} (${currencyCode}), ${toStockLabel(totalStock)}`
}

const truncateForSummary = (text: string, maxChars: number): string =>
  text.length > maxChars ? `${text.slice(0, maxChars)}...` : text

const formatOrderStatusLine = (order: {
  id: string
  status: string
  trackingNumber: string | null
  shippingProvider: string | null
}): string =>
  `${order.id}: ${order.status}, tracking ${order.trackingNumber ?? 'not available'}, carrier ${order.shippingProvider ?? 'not assigned'}`

const fetchReviewSummaryContext = async (
  productId: string
): Promise<string | null> => {
  const rows = await drizzleDb.query.reviews.findMany({
    where: eq(reviews.productId, productId),
    columns: { rating: true, comment: true, createdAt: true },
    orderBy: desc(reviews.createdAt),
    limit: 12,
  })

  if (rows.length === 0)
    return 'No customer reviews are available for this product yet.'

  const average = (
    rows.reduce((sum, row) => sum + row.rating, 0) / rows.length
  ).toFixed(1)
  const positive = rows.filter((row) => row.rating >= 4).length
  const recentComments = rows
    .map((row) => row.comment.trim())
    .filter((comment) => comment.length > 0)
    .slice(0, 3)
    .map(
      (comment) => `- ${truncateForSummary(comment, MAX_REVIEW_COMMENT_CHARS)}`
    )

  return [
    `Review summary: ${rows.length} recent reviews, average rating ${average}/5, ${positive} positive ratings (4★+).`,
    ...(recentComments.length > 0
      ? ['Recent feedback:', ...recentComments]
      : []),
  ].join('\n')
}

const fetchOrderStatusContext = async (
  userId: string,
  text: string
): Promise<string | null> => {
  const orderId = ORDER_ID_PATTERN.exec(text)?.[0] ?? null
  if (orderId) {
    const order = await drizzleDb.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      columns: {
        id: true,
        status: true,
        trackingNumber: true,
        shippingProvider: true,
        createdAt: true,
      },
    })
    if (!order) {
      return `No order with ID "${orderId}" was found for this account.`
    }
    return `Order ${formatOrderStatusLine(order)}.`
  }

  const recentOrders = await drizzleDb.query.orders.findMany({
    where: eq(orders.userId, userId),
    columns: {
      id: true,
      status: true,
      trackingNumber: true,
      shippingProvider: true,
      createdAt: true,
    },
    orderBy: desc(orders.createdAt),
    limit: 3,
  })

  if (recentOrders.length === 0) {
    return 'No orders were found for this account yet.'
  }

  return [
    'Recent order status:',
    ...recentOrders.map((order) => `- ${formatOrderStatusLine(order)}`),
  ].join('\n')
}

const buildCommerceContext = async (params: {
  product: Product
  userId: string
  messageText: string
  currencyCode: CurrencyCode
  formatPrice: (priceInINR: number) => string
  intents: IntentSignals
}): Promise<string[]> => {
  const sections: string[] = []

  if (params.intents.wantsDeliveryInfo) {
    const shippingConfig = await getShippingConfig()
    sections.push(
      `Estimated delivery: approximately ${shippingConfig.estimatedDeliveryDays} business days (standard shipping).`
    )
  }

  const [comparison, recommendation, reviewSummary, orderStatus] =
    await Promise.all([
      params.intents.wantsComparison
        ? fetchComparisonContext(
            params.product,
            params.messageText,
            params.currencyCode,
            params.formatPrice
          )
        : Promise.resolve(null),
      params.intents.wantsRecommendation
        ? fetchRecommendationContext(
            params.product,
            params.messageText,
            params.currencyCode,
            params.formatPrice
          )
        : Promise.resolve(null),
      params.intents.wantsReviewSummary
        ? fetchReviewSummaryContext(params.product.id)
        : Promise.resolve(null),
      params.intents.wantsOrderStatus
        ? fetchOrderStatusContext(params.userId, params.messageText)
        : Promise.resolve(null),
    ])

  for (const section of [
    comparison,
    recommendation,
    reviewSummary,
    orderStatus,
  ]) {
    if (section) sections.push(section)
  }
  return sections
}

const utcDateKey = (): string => new Date().toISOString().slice(0, 10)

const secondsUntilNextUtcMidnight = (): number => {
  const now = new Date()
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  )
  return Math.max(1, Math.ceil((nextMidnightUtc - now.getTime()) / 1000))
}

const getDailyUsage = async (
  userId: string
): Promise<{ requests: number; tokens: number }> => {
  const redis = getRedisClient()
  if (!redis) return { requests: 0, tokens: 0 }

  const key = `ai:chat:usage:${userId}:${utcDateKey()}`
  const raw =
    (await redis.hgetall(key)) ?? {}
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
  const ttlSeconds = secondsUntilNextUtcMidnight()
  await redis.hincrby(key, 'requests', 1)
  await redis.hincrby(key, 'tokens', tokenCount)
  await redis.expire(key, ttlSeconds)
}

const adjustDailyTokenUsage = async (
  userId: string,
  tokenDelta: number
): Promise<void> => {
  if (tokenDelta === 0) return
  const redis = getRedisClient()
  if (!redis) return

  const key = `ai:chat:usage:${userId}:${utcDateKey()}`
  await redis.hincrby(key, 'tokens', tokenDelta)
  await redis.expire(key, secondsUntilNextUtcMidnight())
}

const detectBlockedPrompt = (text: string): string | null => {
  const { normalized, compact } = normalizePolicyText(text)
  if (
    JAILBREAK_PATTERNS.some(
      (pattern) => pattern.test(normalized) || pattern.test(compact)
    )
  ) {
    return 'Prompt contains disallowed instructions.'
  }
  if (
    OFF_DOMAIN_PATTERNS.some(
      (pattern) => pattern.test(normalized) || pattern.test(compact)
    )
  ) {
    return 'Only product-related questions are allowed.'
  }
  return null
}

type AuthorizedSession = Session & { user: { id: string } }

type ChatRequestData = z.infer<typeof ChatRequestSchema>

type PreparedRequest = {
  parsedData: ChatRequestData
  session: AuthorizedSession
  persistHistory: boolean
  threadId: string
  sanitizedMessages: ChatMessage[]
}

const parseAndValidateRequest = async (
  request: NextRequest,
  productId: string
): Promise<NextResponse | PreparedRequest> => {
  const body = await request.json()
  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request body', 400)

  const session = await auth()
  if (!session?.user?.id) return apiError('Authentication required', 401)

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

  const persistHistory = parsed.data.persistHistory ?? false
  const threadId = resolveThreadId(parsed.data.threadId, productId)

  const sanitizedMessages = parsed.data.messages.map((message) => ({
    ...message,
    text: sanitizePromptText(message.text),
  }))
  if (sanitizedMessages.some((message) => message.text.length === 0)) {
    return apiError('Messages must include meaningful text', 400)
  }

  return {
    parsedData: parsed.data,
    session,
    persistHistory,
    threadId,
    sanitizedMessages,
  }
}

const composeConversationMessages = async (
  sanitizedMessages: ChatMessage[],
  persistHistory: boolean,
  userId: string,
  productId: string,
  threadId: string
): Promise<ChatMessage[]> => {
  if (!persistHistory || sanitizedMessages.length !== 1) {
    return sanitizedMessages
  }
  const persisted = await loadPersistedMessages(userId, productId, threadId)
  if (persisted.length === 0) return sanitizedMessages
  return trimMessageHistory(
    [...persisted, ...sanitizedMessages],
    MAX_CONVERSATION_TURNS * 2
  )
}

const resolveCurrencyForUser = async (
  userId: string
): Promise<CurrencyCode> => {
  const userRecord = await drizzleDb.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { currencyPreference: true },
  })
  if (
    userRecord?.currencyPreference &&
    isValidCurrencyCode(userRecord.currencyPreference)
  ) {
    return userRecord.currencyPreference
  }
  return 'INR'
}

const usesAnyAdvancedIntent = (intents: IntentSignals): boolean =>
  intents.wantsComparison ||
  intents.wantsRecommendation ||
  intents.wantsDeliveryInfo ||
  intents.wantsOrderStatus ||
  intents.wantsReviewSummary

const buildSystemPrompt = (
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

type QuotaCheckParams = {
  userId: string
  dailyUsage: { requests: number; tokens: number }
  reservedTotalTokens: number
  requestQuota: number
  tokenQuota: number
  usesAdvancedFeatures: boolean
  advancedQuota: number
}

const enforceQuotas = async (
  params: QuotaCheckParams
): Promise<NextResponse | null> => {
  if (params.dailyUsage.requests + 1 > params.requestQuota) {
    return apiError('Daily AI chat request quota exceeded', 429)
  }
  if (
    params.dailyUsage.tokens + params.reservedTotalTokens >
    params.tokenQuota
  ) {
    return apiError('Daily AI chat token quota exceeded', 429)
  }
  if (params.usesAdvancedFeatures) {
    const advancedUsage = await getAdvancedUsage(params.userId)
    if (advancedUsage + 1 > params.advancedQuota) {
      return apiError('Daily advanced AI request quota exceeded', 429)
    }
    await recordAdvancedUsage(params.userId)
  }
  return null
}

type CachedResponseContext = {
  productId: string
  userId: string
  lastUserText: string
  currencyCode: CurrencyCode
  trimmed: ChatMessage[]
  estimatedInputTokens: number
  dailyUsage: { requests: number; tokens: number }
  threadId: string
  persistHistory: boolean
  maxHistoryMessages: number
  chatModel: string
}

const respondWithCachedAnswer = async (
  cached: string,
  ctx: CachedResponseContext
): Promise<NextResponse> => {
  const outputTokens = estimateTokens(cached)
  const totalTokens = ctx.estimatedInputTokens + outputTokens
  await recordDailyUsage(ctx.userId, totalTokens)

  logBusinessEvent({
    event: 'ai_chat_request',
    details: {
      productId: ctx.productId,
      chatModel: ctx.chatModel,
      messageCount: ctx.trimmed.length,
      cached: true,
    },
    success: true,
  })
  logBusinessEvent({
    event: 'ai_chat_usage',
    userId: ctx.userId,
    details: {
      productId: ctx.productId,
      cached: true,
      inputTokens: ctx.estimatedInputTokens,
      outputTokens,
      totalTokens,
      requestsUsed: ctx.dailyUsage.requests + 1,
    },
    success: true,
  })

  if (ctx.persistHistory) {
    const historyToPersist = trimMessageHistory(
      [
        ...ctx.trimmed,
        { role: 'assistant', text: sanitizeAssistantOutput(cached) },
      ],
      ctx.maxHistoryMessages
    )
    await persistMessages(
      ctx.userId,
      ctx.productId,
      ctx.threadId,
      historyToPersist
    )
  }

  return NextResponse.json(
    { text: cached, threadId: ctx.persistHistory ? ctx.threadId : undefined },
    ctx.persistHistory
      ? { headers: { 'X-AI-Thread-ID': ctx.threadId } }
      : undefined
  )
}

const buildStreamReader = (
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

type StreamSideEffectContext = {
  fullTextPromise: Promise<string>
  productId: string
  userId: string
  lastUserText: string
  currencyCode: CurrencyCode
  isSingleTurn: boolean
  persistHistory: boolean
  threadId: string
  trimmed: ChatMessage[]
  estimatedInputTokens: number
  reservedTotalTokens: number
  dailyUsage: { requests: number; tokens: number }
  maxHistoryMessages: number
}

const scheduleStreamSideEffects = (ctx: StreamSideEffectContext): void => {
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
            productId: ctx.productId,
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
          additionalInfo: { productId: ctx.productId, userId: ctx.userId },
        })
      )
  )

  if (ctx.isSingleTurn && ctx.lastUserText) {
    waitUntil(
      ctx.fullTextPromise
        .then((text) => {
          if (text)
            return setCachedAiResponse(
              ctx.productId,
              ctx.lastUserText,
              ctx.currencyCode,
              text
            )
        })
        .catch((error) =>
          logError({
            error,
            context: 'ai_cache_background_write',
            additionalInfo: { productId: ctx.productId },
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
            ctx.productId,
            ctx.threadId,
            historyToPersist
          )
        })
        .catch((error) =>
          logError({
            error,
            context: 'ai_chat_history_persist',
            additionalInfo: {
              productId: ctx.productId,
              userId: ctx.userId,
              threadId: ctx.threadId,
            },
          })
        )
    )
  }
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
    if (!product) return apiError('Product not found', 404)

    const prepared = await parseAndValidateRequest(request, id)
    if (prepared instanceof NextResponse) return prepared

    const { session, persistHistory, threadId, sanitizedMessages } = prepared

    const allMessages = await composeConversationMessages(
      sanitizedMessages,
      persistHistory,
      session.user.id,
      id,
      threadId
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
    const currencyCode = await resolveCurrencyForUser(session.user.id)

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
      userId: session.user.id,
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

    const dailyUsage = await getDailyUsage(session.user.id)
    const quotaError = await enforceQuotas({
      userId: session.user.id,
      dailyUsage,
      reservedTotalTokens,
      requestQuota: aiConfig.dailyRequestQuota ?? DAILY_REQUEST_QUOTA,
      tokenQuota: aiConfig.dailyTokenQuota ?? DAILY_TOKEN_QUOTA,
      usesAdvancedFeatures,
      advancedQuota:
        aiConfig.advancedFeatureDailyRequestQuota ??
        ADVANCED_DAILY_REQUEST_QUOTA,
    })
    if (quotaError) return quotaError

    if (isSingleTurn && lastUserText) {
      const cached = await getCachedAiResponse(id, lastUserText, currencyCode)
      if (cached !== null) {
        return respondWithCachedAnswer(cached, {
          productId: id,
          userId: session.user.id,
          lastUserText,
          currencyCode,
          trimmed,
          estimatedInputTokens,
          dailyUsage,
          threadId,
          persistHistory,
          maxHistoryMessages: aiConfig.maxHistoryMessages,
          chatModel: aiConfig.chatModel,
        })
      }
    }

    const contents = toGoogleContents(trimmed)
    const generateConfig = {
      ...buildGenerateConfig(aiConfig, systemPrompt),
      maxOutputTokens: Math.min(aiConfig.maxResponseTokens, MAX_OUTPUT_TOKENS),
    }
    const messageCount = trimmed.length

    await recordDailyUsage(session.user.id, reservedTotalTokens)

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

    const { readable, fullTextPromise } = buildStreamReader(stream)

    scheduleStreamSideEffects({
      fullTextPromise,
      productId: id,
      userId: session.user.id,
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
