import { drizzleDb } from '@/lib/db'
import { getShippingConfig } from '@/lib/edge-config'
import { orders, reviews } from '@/lib/schema'
import { and, desc, eq } from 'drizzle-orm'
import type { CurrencyCode } from '@/lib/currency'
import type { Product } from '@/lib/types'
import type { IntentSignals } from './chat-types'
import { MAX_REVIEW_COMMENT_CHARS } from './chat-constants'
import { ORDER_ID_PATTERN } from './chat-intent'

export const toStockLabel = (stock: number): string => {
  if (stock > 5) return 'In Stock'
  if (stock > 0) return 'Low Stock'
  return 'Out of Stock'
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

  const [reviewSummary, orderStatus] = await Promise.all([
    params.intents.wantsReviewSummary
      ? fetchReviewSummaryContext(params.product.id)
      : Promise.resolve(null),
    fetchOrderStatusSection(params),
  ])

  for (const section of [reviewSummary, orderStatus]) {
    if (section) sections.push(section)
  }
  return sections
}
