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
