import { drizzleDb } from '@/lib/db'
import { getShippingConfig } from '@/lib/edge-config'
import { products, orders, reviews } from '@/lib/schema'
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm'
import {
  getVariantMinPrice,
  getVariantTotalStock,
} from '@/features/product/variant-utils'
import type { CurrencyCode } from '@/lib/currency'
import type { Product } from '@/lib/types'
import type { IntentSignals } from './chat-types'
import { MAX_REVIEW_COMMENT_CHARS } from './chat-constants'
import { ORDER_ID_PATTERN, parseBudgetInINR } from './chat-intent'

export const toStockLabel = (stock: number): string => {
  if (stock > 5) return 'In Stock'
  if (stock > 0) return 'Low Stock'
  return 'Out of Stock'
}

const escapeLikeValue = (value: string): string =>
  value.replace(/[\\%_]/g, String.raw`\$&`)

const truncateForSummary = (text: string, maxChars: number): string =>
  text.length > maxChars ? `${text.slice(0, maxChars)}...` : text

export const extractComparisonTerms = (
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

const formatOrderStatusLine = (order: {
  id: string
  status: string
  trackingNumber: string | null
  shippingProvider: string | null
}): string =>
  `${order.id}: ${order.status}, tracking ${order.trackingNumber ?? 'not available'}, carrier ${order.shippingProvider ?? 'not assigned'}`

export const fetchComparisonContext = async (
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

export const fetchRecommendationContext = async (
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

export const fetchReviewSummaryContext = async (
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

export const fetchOrderStatusContext = async (
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

const fetchOrderStatusSection = (params: {
  userId: string
  isAuthenticated: boolean
  messageText: string
  intents: IntentSignals
}): Promise<string | null> => {
  if (!params.intents.wantsOrderStatus) return Promise.resolve(null)
  if (!params.isAuthenticated) {
    return Promise.resolve(
      'Sign in to check your recent orders and tracking details for your account.'
    )
  }
  return fetchOrderStatusContext(params.userId, params.messageText)
}

/**
 * Dispatches the intent-selected commerce "tools" and returns the supplemental
 * prompt sections they produced, in a stable order.
 */
export const buildCommerceContext = async (params: {
  product: Product
  userId: string
  isAuthenticated: boolean
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
      fetchOrderStatusSection(params),
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
