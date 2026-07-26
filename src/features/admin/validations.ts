import { z } from 'zod'
import { SHORT_ID_REGEX } from '@/lib/validations/primitives'
import { MAX_MONEY_AMOUNT } from '@/lib/money'
import { DISCOUNT_TYPES } from '@/features/cart/services/coupon-service'

// ─── Admin Email-Failures Validation Schemas ──────────────

export const FailedEmailQuerySchema = z.object({
  status: z.string().optional().default('pending,failed'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const ManualRetryBodySchema = z.object({
  ids: z
    .array(z.string().regex(SHORT_ID_REGEX, 'Invalid short ID format'))
    .min(1, 'At least one ID required')
    .max(50, 'Maximum 50 IDs per request'),
})

export type FailedEmailQuery = z.infer<typeof FailedEmailQuerySchema>
export type ManualRetryBody = z.infer<typeof ManualRetryBodySchema>

// ─── Admin Coupon Validation Schemas ──────────────────────

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())
  .nullish()

const nonNegativeMoney = z
  .number()
  .nonnegative('Amount cannot be negative')
  .max(MAX_MONEY_AMOUNT, 'Amount is too large')

/**
 * Field definitions without defaults. The patch schema is built from these so
 * a partial update never silently rewrites omitted columns to their defaults.
 */
const couponFields = {
  code: z
    .string()
    .trim()
    .min(3, 'Code must be at least 3 characters')
    .max(32, 'Code must be at most 32 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, digits, - and _')
    .transform((code) => code.toUpperCase()),
  description: z.string().trim().max(500).nullish(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: nonNegativeMoney,
  maxDiscountAmount: nonNegativeMoney.nullish(),
  minCartValue: nonNegativeMoney,
  scopedCategories: z.array(z.string().trim().min(1)).max(50),
  scopedProductIds: z
    .array(z.string().regex(SHORT_ID_REGEX, 'Invalid product ID'))
    .max(100),
  usageLimit: z.number().int().positive().nullish(),
  perUserLimit: z.number().int().positive().nullish(),
  stackable: z.boolean(),
  isActive: z.boolean(),
  startsAt: optionalDate,
  endsAt: optionalDate,
}

export const CouponBaseSchema = z.object({
  ...couponFields,
  discountValue: couponFields.discountValue.default(0),
  minCartValue: couponFields.minCartValue.default(0),
  scopedCategories: couponFields.scopedCategories.default([]),
  scopedProductIds: couponFields.scopedProductIds.default([]),
  stackable: couponFields.stackable.default(false),
  isActive: couponFields.isActive.default(true),
})

type CouponRuleInput = Partial<z.infer<typeof CouponBaseSchema>>

/** Cross-field rules shared by the create and update payloads. */
const applyCouponRules = (value: CouponRuleInput, ctx: z.RefinementCtx) => {
  if (
    value.discountType === 'PERCENTAGE' &&
    (value.discountValue === undefined ||
      value.discountValue <= 0 ||
      value.discountValue > 100)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'Percentage discount must be between 0 and 100',
    })
  }

  if (
    value.discountType === 'FIXED_AMOUNT' &&
    (value.discountValue === undefined || value.discountValue <= 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'Fixed discount must be greater than zero',
    })
  }

  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'End date must be after the start date',
    })
  }
}

export const CreateCouponSchema = CouponBaseSchema.superRefine(applyCouponRules)
export const UpdateCouponSchema = z
  .object(couponFields)
  .partial()
  .superRefine(applyCouponRules)

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>
