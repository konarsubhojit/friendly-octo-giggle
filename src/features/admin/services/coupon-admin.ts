import type { coupons } from '@/lib/schema'
import { parseMoney } from '@/lib/money'
import type { UpdateCouponInput } from '@/features/admin/validations'
import type { DiscountType } from '@/lib/constants/discounts'

export interface AdminCouponRecord {
  readonly id: string
  readonly code: string
  readonly description: string | null
  readonly discountType: DiscountType
  readonly discountValue: number
  readonly maxDiscountAmount: number | null
  readonly minCartValue: number
  readonly scopedCategories: string[]
  readonly scopedProductIds: string[]
  readonly usageLimit: number | null
  readonly perUserLimit: number | null
  readonly usageCount: number
  readonly stackable: boolean
  readonly isActive: boolean
  readonly startsAt: string | null
  readonly endsAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AdminCouponRedemptionSummary {
  readonly couponId: string
  readonly code: string
  readonly discountType: DiscountType
  readonly isActive: boolean
  readonly usageLimit: number | null
  readonly usageCount: number
  readonly redemptionCount: number
  readonly totalDiscount: number
  readonly lastRedeemedAt: string | null
}

const toIsoString = (value: Date | string | null): string | null => {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : value
}

export const serializeCoupon = (
  row: typeof coupons.$inferSelect
): AdminCouponRecord => ({
  id: row.id,
  code: row.code,
  description: row.description,
  discountType: row.discountType,
  discountValue: row.discountValue,
  maxDiscountAmount: row.maxDiscountAmount,
  minCartValue: row.minCartValue,
  scopedCategories: row.scopedCategories,
  scopedProductIds: row.scopedProductIds,
  usageLimit: row.usageLimit,
  perUserLimit: row.perUserLimit,
  usageCount: row.usageCount,
  stackable: row.stackable,
  isActive: row.isActive,
  startsAt: toIsoString(row.startsAt),
  endsAt: toIsoString(row.endsAt),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const serializeRedemptionSummary = (row: {
  couponId: string
  code: string
  discountType: DiscountType
  isActive: boolean
  usageLimit: number | null
  usageCount: number
  redemptionCount: number
  totalDiscount: number | string
  lastRedeemedAt: Date | string | null
}): AdminCouponRedemptionSummary => ({
  couponId: row.couponId,
  code: row.code,
  discountType: row.discountType,
  isActive: row.isActive,
  usageLimit: row.usageLimit,
  usageCount: row.usageCount,
  redemptionCount: Number(row.redemptionCount),
  totalDiscount: parseMoney(row.totalDiscount) ?? 0,
  lastRedeemedAt: toIsoString(row.lastRedeemedAt),
})

/**
 * Map a validated patch payload onto persistable column values, leaving out
 * every field the admin did not send.
 */
export const buildCouponUpdateValues = (
  input: UpdateCouponInput
): Partial<typeof coupons.$inferInsert> => {
  const values: Partial<typeof coupons.$inferInsert> = {}

  if (input.code !== undefined) values.code = input.code
  if (input.description !== undefined) {
    values.description = input.description ?? null
  }
  if (input.discountType !== undefined) values.discountType = input.discountType
  if (input.discountValue !== undefined) {
    values.discountValue = input.discountValue
  }
  if (input.maxDiscountAmount !== undefined) {
    values.maxDiscountAmount = input.maxDiscountAmount ?? null
  }
  if (input.minCartValue !== undefined) values.minCartValue = input.minCartValue
  if (input.scopedCategories !== undefined) {
    values.scopedCategories = input.scopedCategories
  }
  if (input.scopedProductIds !== undefined) {
    values.scopedProductIds = input.scopedProductIds
  }
  if (input.usageLimit !== undefined)
    values.usageLimit = input.usageLimit ?? null
  if (input.perUserLimit !== undefined) {
    values.perUserLimit = input.perUserLimit ?? null
  }
  if (input.stackable !== undefined) values.stackable = input.stackable
  if (input.isActive !== undefined) values.isActive = input.isActive
  if (input.startsAt !== undefined) {
    values.startsAt = input.startsAt ? new Date(input.startsAt) : null
  }
  if (input.endsAt !== undefined) {
    values.endsAt = input.endsAt ? new Date(input.endsAt) : null
  }

  return values
}
