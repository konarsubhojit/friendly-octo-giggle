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

export const UpdateAddressSchema = z
  .object({
    label: AddressLabelSchema.optional(),
    ...StructuredAddressSchema.partial().shape,
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export type CreateAddressInput = z.infer<typeof CreateAddressSchema>
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>
