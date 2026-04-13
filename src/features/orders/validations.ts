import { z } from 'zod'
import { SHORT_ID_REGEX, EMAIL_REGEX } from '@/lib/validations/primitives'

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

export const CheckoutRequestStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
])

export const OrderItemSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, 'Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive'),
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

export type OrderStatusType = z.infer<typeof OrderStatusEnum>
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
