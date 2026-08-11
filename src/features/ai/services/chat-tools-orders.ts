import { desc, eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { drizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { TOOL_RESULT_MAX_CHARS } from './chat-constants'
import type { AssistantTool } from './chat-types'

const ORDER_ID_REGEX = /^[A-Za-z0-9]{7,10}$/

const truncateToolResult = (value: string): string =>
  value.length > TOOL_RESULT_MAX_CHARS
    ? `${value.slice(0, TOOL_RESULT_MAX_CHARS - 1)}…`
    : value

export const GetOrderStatusArgs = z.object({
  orderId: z.string().trim().regex(ORDER_ID_REGEX).optional(),
})

export const formatOrderStatusLine = (order: {
  id: string
  status: string
  trackingNumber: string | null
  shippingProvider: string | null
}): string =>
  `${order.id}: ${order.status}, tracking ${order.trackingNumber ?? 'not available'}, carrier ${order.shippingProvider ?? 'not assigned'}`

export const fetchOrderStatusContext = async (
  userId: string,
  orderId?: string
): Promise<string> => {
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

export const getOrderStatusTool: AssistantTool<
  z.infer<typeof GetOrderStatusArgs>
> = {
  name: 'get_order_status',
  description:
    'Look up the authenticated shopper’s recent order status or a specific order id without exposing another user’s data.',
  argsSchema: GetOrderStatusArgs,
  requiresAuth: true,
  async execute(args, ctx) {
    if (!ctx.identity.isAuthenticated) {
      return 'Sign in to check your orders.'
    }

    return truncateToolResult(
      await fetchOrderStatusContext(ctx.identity.userId, args.orderId)
    )
  },
}
