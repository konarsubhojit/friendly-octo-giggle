import { z } from 'zod'
import {
  SHORT_ID_REGEX,
  EMAIL_REGEX,
  MAX_MONEY_AMOUNT,
  hasMoneyPrecision,
} from '@/lib/validations/primitives'
import { PaymentReferenceSchema } from '@/lib/validations/payment'
import {
  RETURN_EVIDENCE_MAX,
  RETURN_EVIDENCE_MIN,
  RETURN_REASONS,
} from '@/lib/constants/returns'

export const StructuredAddressSchema = z.object({
  addressLine1: z
    .string()
    .trim()
    .min(1, 'Address Line 1 is required')
    .max(200, 'Address Line 1 must be under 200 characters'),
  addressLine2: z
    .string()
    .trim()
    .max(200, 'Address Line 2 must be under 200 characters')
    .optional()
    .default(''),
  addressLine3: z
    .string()
    .trim()
    .max(200, 'Address Line 3 must be under 200 characters')
    .optional()
    .default(''),
  pinCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Pin code must be exactly 6 digits'),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City must be under 100 characters'),
  state: z
    .string()
    .trim()
    .min(1, 'State is required')
    .max(100, 'State must be under 100 characters'),
})

export const OrderStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
])

export const PaymentStatusEnum = z.enum([
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
])

export const CheckoutRequestStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
])

export const OrderItemSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, 'Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z
    .number()
    .positive('Price must be positive')
    .max(MAX_MONEY_AMOUNT, 'Price is out of the supported range')
    .refine(hasMoneyPrecision, 'Price supports at most 2 decimal places'),
  customizationNote: z
    .string()
    .max(500, 'Customization note must be under 500 characters')
    .nullish(),
})

export const CreateOrderSchema = z.object({
  customerName: z.string().min(1, 'Name is required').max(200),
  customerEmail: z.string().regex(EMAIL_REGEX, 'Invalid email address'),
  ...StructuredAddressSchema.shape,
  items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
  payment: PaymentReferenceSchema,
})

/**
 * Admin refund request. Omitting `amount` refunds the whole refundable balance;
 * supplying one issues a partial refund.
 */
export const RefundOrderSchema = z.object({
  amount: z
    .number()
    .positive('Refund amount must be positive')
    .max(MAX_MONEY_AMOUNT, 'Refund amount is out of the supported range')
    .refine(
      hasMoneyPrecision,
      'Refund amount supports at most 2 decimal places'
    )
    .optional(),
  reason: z
    .string()
    .trim()
    .max(500, 'Reason must be under 500 characters')
    .optional(),
})

export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusEnum,
  trackingNumber: z
    .string()
    .max(100, 'Tracking number must be under 100 characters')
    .nullish(),
  shippingProvider: z
    .string()
    .max(100, 'Shipping provider must be under 100 characters')
    .nullish(),
})

/**
 * Payload for an operator-initiated reservation release.
 *
 * The reason is recorded in the admin audit log, so a manual release is always
 * attributable to a person and a stated cause.
 */
export const ReleaseReservationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(200, 'Reason must be under 200 characters')
    .default('admin_manual_release'),
})

/**
 * Payload for a customer-initiated damaged-item return claim.
 *
 * `evidenceIds` is required, not optional: the published policy requires
 * photographic evidence before any damage claim is reviewed, so a claim
 * without it cannot be actioned and must not be accepted. The ids reference
 * `ReturnEvidence` rows uploaded beforehand and still orphaned.
 */
export const CreateReturnRequestSchema = z.object({
  reason: z.enum(RETURN_REASONS),
  customerNote: z
    .string()
    .trim()
    .max(1000, 'Note must be under 1000 characters')
    .optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().regex(SHORT_ID_REGEX, 'Invalid order item id'),
        quantity: z
          .number()
          .int('Quantity must be a whole number')
          .positive('Quantity must be at least 1'),
      })
    )
    .min(1, 'Select at least one item to return')
    .max(50, 'Too many items in one return')
    // Two entries for one line would each pass the availability check on their
    // own and together exceed the quantity ordered — which the refund
    // calculator would price before the unique index aborted the insert.
    .refine(
      (items) =>
        new Set(items.map((item) => item.orderItemId)).size === items.length,
      'Each item may appear only once'
    ),
  evidenceIds: z
    .array(z.string().regex(SHORT_ID_REGEX, 'Invalid evidence id'))
    .min(RETURN_EVIDENCE_MIN, 'At least one photo of the damage is required')
    .max(RETURN_EVIDENCE_MAX, `At most ${RETURN_EVIDENCE_MAX} photos`),
})

/**
 * Administrator action on a return.
 *
 * `receive` and `refund` are distinct: receiving moves inventory and needs
 * `orders:returns`, refunding moves money and needs `orders:refund`. Keeping
 * them apart is also what lets a gateway-rejected refund be retried instead of
 * stranding the return.
 */
export const DecideReturnSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    decisionReason: z
      .string()
      .trim()
      .min(1, 'A reason is required')
      .max(500, 'Reason must be under 500 characters'),
  }),
  z.object({
    action: z.literal('reject'),
    decisionReason: z
      .string()
      .trim()
      .min(1, 'A reason is required')
      .max(500, 'Reason must be under 500 characters'),
  }),
  z.object({ action: z.literal('receive') }),
  z.object({ action: z.literal('refund') }),
  z.object({ action: z.literal('settle') }),
])

export type OrderStatusType = z.infer<typeof OrderStatusEnum>
export type ReleaseReservationInput = z.infer<typeof ReleaseReservationSchema>
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
export type RefundOrderInput = z.infer<typeof RefundOrderSchema>
export type CreateReturnRequestInput = z.infer<typeof CreateReturnRequestSchema>
export type DecideReturnInput = z.infer<typeof DecideReturnSchema>
