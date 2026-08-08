import { eventType } from 'inngest'
import { z } from 'zod'
import { SHIPPING_METHODS } from '@/lib/shipping/methods'
import { RETURN_STATUSES } from '@/lib/constants/returns'

const CurrencyCodeSchema = z.enum(['INR', 'USD', 'EUR', 'GBP'])

const OrderEmailItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
})

/**
 * A new order exists and has been paid for.
 *
 * Unlike the checkout event this carries the full email payload rather than
 * just an id. The confirmation email has to reflect the order *as purchased* —
 * pricing, coupon and shipping method at the moment of sale — so re-reading
 * the row on a retry would risk emailing figures that a later admin edit
 * changed. These are exactly the fields the (proven) QStash `order.created`
 * schema carried.
 */
export const orderCreated = eventType('order/created', {
  schema: z.object({
    orderId: z.string().min(1),
    userId: z.string().min(1).nullish(),
    checkoutRequestId: z.string().min(1).nullish(),
    customerEmail: z.email(),
    customerName: z.string().min(1),
    customerAddress: z.string().min(1),
    subtotalAmount: z.number().nonnegative().optional(),
    shippingAmount: z.number().nonnegative().optional(),
    taxAmount: z.number().nonnegative().optional(),
    shippingMethod: z.enum(SHIPPING_METHODS).optional(),
    totalAmount: z.number().positive(),
    discountAmount: z.number().nonnegative().optional(),
    couponCode: z.string().nullish(),
    currencyCode: CurrencyCodeSchema,
    items: z.array(OrderEmailItemSchema),
    productIds: z.array(z.string().min(1)),
  }),
})

/** An order moved to a new fulfilment status. */
export const orderStatusChanged = eventType('order/status.changed', {
  schema: z.object({
    orderId: z.string().min(1),
    userId: z.string().min(1).nullish(),
    customerEmail: z.email(),
    customerName: z.string().min(1),
    newStatus: z.enum([
      'PENDING',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ]),
    trackingNumber: z.string().nullable(),
    shippingProvider: z.string().nullable(),
  }),
})

/** A refund was recorded against an order. */
export const orderRefunded = eventType('order/refunded', {
  schema: z.object({
    orderId: z.string().min(1),
    /**
     * Identifies this specific refund. Part of the idempotency key, because an
     * order can legitimately be refunded more than once.
     */
    refundId: z.string().min(1),
    userId: z.string().min(1).nullish(),
    customerEmail: z.email(),
    customerName: z.string().min(1),
    refundAmount: z.number().positive(),
    refundStatus: z.enum(['PENDING', 'PROCESSED', 'FAILED']),
    isPartial: z.boolean(),
    reason: z.string().nullish(),
    currencyCode: CurrencyCodeSchema,
  }),
})

/**
 * A damaged-item return claim moved to a new state.
 *
 * `returnId` plus `status` form the idempotency key: a return passes through
 * several states, and each one warrants its own notification, but a replayed
 * event for a state already announced must not send twice.
 */
export const returnStatusChanged = eventType('order/return.status.changed', {
  schema: z.object({
    returnId: z.string().min(1),
    orderId: z.string().min(1),
    userId: z.string().min(1).nullish(),
    customerEmail: z.email(),
    customerName: z.string().min(1),
    status: z.enum(RETURN_STATUSES),
    /** Admin-authored copy shown to the customer on approve and reject. */
    decisionReason: z.string().nullish(),
    /** Present once money has been committed to the claim. */
    refundAmount: z.number().nonnegative().nullish(),
  }),
})

/**
 * Ask for an order to be (re)written into the Redis search mirror.
 *
 * Id-only on purpose: the indexer re-reads the row, so a retry that lands
 * after a status change mirrors the current state instead of resurrecting the
 * state at publish time.
 */
export const orderSearchIndexRequested = eventType(
  'search/order.index.requested',
  {
    schema: z.object({
      orderId: z.string().min(1),
    }),
  }
)

/** Ask for the caches affected by an order write to be invalidated. */
export const orderCacheInvalidateRequested = eventType(
  'cache/order.invalidate',
  {
    schema: z.object({
      orderId: z.string().min(1),
      userId: z.string().min(1).nullish(),
      productIds: z.array(z.string().min(1)),
    }),
  }
)
