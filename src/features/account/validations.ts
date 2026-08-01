import { z } from 'zod'
import { StructuredAddressSchema } from '@/features/orders/validations'

export const AddressLabelSchema = z
  .string()
  .trim()
  .min(1, 'Address label is required')
  .max(100, 'Address label must be under 100 characters')

export const CreateAddressSchema = z.object({
  label: AddressLabelSchema.default('Saved address'),
  ...StructuredAddressSchema.shape,
  isDefault: z.boolean().optional().default(false),
})

const UpdateOptionalAddressLine2Schema = z
  .string()
  .trim()
  .max(200, 'Address Line 2 must be under 200 characters')
  .optional()

const UpdateOptionalAddressLine3Schema = z
  .string()
  .trim()
  .max(200, 'Address Line 3 must be under 200 characters')
  .optional()

export const UpdateAddressSchema = z
  .object({
    label: AddressLabelSchema.optional(),
    addressLine1: StructuredAddressSchema.shape.addressLine1.optional(),
    addressLine2: UpdateOptionalAddressLine2Schema,
    addressLine3: UpdateOptionalAddressLine3Schema,
    pinCode: StructuredAddressSchema.shape.pinCode.optional(),
    city: StructuredAddressSchema.shape.city.optional(),
    state: StructuredAddressSchema.shape.state.optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export type CreateAddressInput = z.infer<typeof CreateAddressSchema>
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>

export const UpdateNotificationPreferencesSchema = z
  .object({
    transactionalEmail: z.boolean().optional(),
    transactionalPush: z.boolean().optional(),
    transactionalSms: z.boolean().optional(),
    marketingEmail: z.boolean().optional(),
    marketingPush: z.boolean().optional(),
    marketingSms: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one preference is required',
  })

export type UpdateNotificationPreferencesInput = z.infer<
  typeof UpdateNotificationPreferencesSchema
>

/**
 * Push endpoints are supplied by the browser and later requested server-side,
 * so they are restricted to HTTPS to avoid outbound requests to arbitrary
 * internal schemes.
 */
const PushEndpointSchema = z
  .url()
  .max(2048, 'Push endpoint is too long')
  .refine(
    (value) => value.startsWith('https://'),
    'Push endpoint must use HTTPS'
  )

/** Browser `PushSubscription.toJSON()` payload (RFC 8291 keys). */
export const PushSubscriptionSchema = z.object({
  endpoint: PushEndpointSchema,
  keys: z.object({
    p256dh: z.string().trim().min(1).max(255),
    auth: z.string().trim().min(1).max(255),
  }),
})

export const DeletePushSubscriptionSchema = z.object({
  endpoint: PushEndpointSchema,
})

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionSchema>
