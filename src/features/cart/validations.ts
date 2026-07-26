import { z } from 'zod'
import { SHORT_ID_REGEX, EMAIL_REGEX } from '@/lib/validations/primitives'
import { StructuredAddressSchema } from '@/features/orders/validations'
import { PaymentReferenceSchema } from '@/lib/validations/payment'
import { SHIPPING_METHODS } from '@/lib/shipping/methods'

export const AddToCartSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, 'Invalid product ID'),
  variantId: z.string().regex(SHORT_ID_REGEX, 'Invalid variant ID'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be positive'),
})

export const UpdateCartItemSchema = z.object({
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be positive'),
})

export type AddToCartInput = z.infer<typeof AddToCartSchema>
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>

export const CheckoutOrderItemSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, 'Invalid product ID'),
  variantId: z.string().regex(SHORT_ID_REGEX, 'Invalid variant ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  customizationNote: z
    .string()
    .max(500, 'Customization note must be under 500 characters')
    .nullish(),
})

export const CheckoutPaymentSchema = PaymentReferenceSchema

/**
 * Promo code accepted at checkout. Only the code is accepted — the discount is
 * always recomputed server-side, so a tampered client total has no effect.
 */
export const CouponCodeSchema = z
  .string()
  .trim()
  .min(3, 'Coupon code is too short')
  .max(32, 'Coupon code is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code contains invalid characters')
  .transform((code) => code.toUpperCase())

export const SubmitCheckoutSchema = z.object({
  customerName: z.string().min(1, 'Name is required').max(200),
  customerEmail: z.string().regex(EMAIL_REGEX, 'Invalid email address'),
  ...StructuredAddressSchema.shape,
  items: z
    .array(CheckoutOrderItemSchema)
    .min(1, 'At least one item is required'),
  couponCode: CouponCodeSchema.optional(),
  shippingMethod: z.enum(SHIPPING_METHODS).optional(),
  payment: CheckoutPaymentSchema.optional(),
})

export const ApplyCouponSchema = z.object({
  couponCode: CouponCodeSchema,
})

export const CheckoutQueueMessageSchema = z.object({
  checkoutRequestId: z
    .string()
    .regex(SHORT_ID_REGEX, 'Invalid checkout request ID'),
})

export type SubmitCheckoutInput = z.infer<typeof SubmitCheckoutSchema>
