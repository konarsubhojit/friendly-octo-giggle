import { z } from 'zod'
import {
  EMAIL_REGEX,
  PHONE_REGEX,
  PASSWORD_REGEX,
} from '@/lib/validations/primitives'

// ─── Auth Validation Schemas ─────────────────────────────

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    email: z.string().regex(EMAIL_REGEX, 'Invalid email address'),
    phoneNumber: z
      .string()
      .regex(PHONE_REGEX, 'Invalid phone number format')
      .nullish(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        PASSWORD_REGEX,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export const credentialsLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone number is required'),
  password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        PASSWORD_REGEX,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ['confirmNewPassword'],
  })

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(200).optional(),
  email: z.string().regex(EMAIL_REGEX, 'Invalid email address').optional(),
  phoneNumber: z
    .string()
    .regex(PHONE_REGEX, 'Invalid phone number format')
    .nullish(),
  currencyPreference: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type CredentialsLoginInput = z.infer<typeof credentialsLoginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
