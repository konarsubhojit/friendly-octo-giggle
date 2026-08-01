import { z } from 'zod'
import { SHIPPING_METHODS } from '@/lib/shipping/methods'

const OrderEmailItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
})

const OrderCreatedEventSchema = z.object({
  type: z.literal('order.created'),
  data: z.object({
    orderId: z.string().min(1),
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
    currencyCode: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
    items: z.array(OrderEmailItemSchema),
  }),
})

const OrderStatusChangedEventSchema = z.object({
  type: z.literal('order.status_changed'),
  data: z.object({
    orderId: z.string().min(1),
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

const OrderRefundedEventSchema = z.object({
  type: z.literal('order.refunded'),
  data: z.object({
    orderId: z.string().min(1),
    customerEmail: z.email(),
    customerName: z.string().min(1),
    refundAmount: z.number().positive(),
    refundStatus: z.enum(['PENDING', 'PROCESSED', 'FAILED']),
    /** True when only part of the order total was refunded. */
    isPartial: z.boolean(),
    reason: z.string().nullish(),
    currencyCode: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  }),
})

export const QStashEmailEventSchema = z.discriminatedUnion('type', [
  OrderCreatedEventSchema,
  OrderStatusChangedEventSchema,
  OrderRefundedEventSchema,
])

export type QStashEmailEvent = z.infer<typeof QStashEmailEventSchema>
export type OrderCreatedEvent = z.infer<typeof OrderCreatedEventSchema>
export type OrderStatusChangedEvent = z.infer<
  typeof OrderStatusChangedEventSchema
>
export type OrderRefundedEvent = z.infer<typeof OrderRefundedEventSchema>
export type OrderEmailItem = z.infer<typeof OrderEmailItemSchema>
