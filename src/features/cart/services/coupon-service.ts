/**
 * Discount / coupon engine.
 *
 * The pure evaluation functions in this module never read the request body's
 * money fields — they only accept a coupon *code* plus the server-priced cart
 * lines. Totals are therefore always recomputed server side and a tampered
 * client total can never influence what is charged.
 */

import { db } from '@/lib/db'
import { convertMoney, multiplyMoney, roundMoney, sumMoney } from '@/lib/money'
import type { coupons } from '@/lib/schema'

/** Maximum number of coupon codes that may be applied to a single cart. */
export const MAX_COUPONS_PER_CART = 5

export type DiscountType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'FREE_SHIPPING'
  | 'BOGO'

export const DISCOUNT_TYPES: readonly DiscountType[] = [
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_SHIPPING',
  'BOGO',
]

export interface CouponRecord {
  readonly id: string
  readonly code: string
  readonly discountType: DiscountType
  readonly discountValue: number
  readonly maxDiscountAmount: number | null
  readonly minCartValue: number
  readonly scopedCategories: readonly string[]
  readonly scopedProductIds: readonly string[]
  readonly usageLimit: number | null
  readonly perUserLimit: number | null
  readonly usageCount: number
  readonly stackable: boolean
  readonly isActive: boolean
  readonly startsAt: Date | null
  readonly endsAt: Date | null
}

/** A server-priced cart line. `unitPrice` always comes from the database. */
export interface DiscountCartItem {
  readonly productId: string
  readonly category: string
  readonly quantity: number
  readonly unitPrice: number
}

export interface AppliedCoupon {
  readonly couponId: string
  readonly code: string
  readonly discountType: DiscountType
  readonly discountAmount: number
  readonly freeShipping: boolean
}

export interface DiscountBreakdown {
  readonly subtotal: number
  readonly discountAmount: number
  readonly shippingAmount: number
  readonly total: number
  readonly appliedCoupons: readonly AppliedCoupon[]
}

/** Raised when a coupon cannot be applied. Carries an HTTP status for routes. */
export class CouponError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'CouponError'
    this.status = status
  }
}

export const isCouponError = (error: unknown): error is CouponError =>
  error instanceof CouponError

/** Narrow a persisted coupon row to the shape the engine needs. */
export const toCouponRecord = (
  row: typeof coupons.$inferSelect
): CouponRecord => ({
  id: row.id,
  code: row.code,
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
  startsAt: row.startsAt,
  endsAt: row.endsAt,
})

/** Codes are stored and compared upper-cased so redemption is case-insensitive. */
export const normalizeCouponCode = (code: string): string =>
  code.trim().toUpperCase()

export const calculateSubtotal = (items: readonly DiscountCartItem[]): number =>
  sumMoney(items.map((item) => multiplyMoney(item.unitPrice, item.quantity)))

const isInScope = (coupon: CouponRecord, item: DiscountCartItem): boolean => {
  const hasProductScope = coupon.scopedProductIds.length > 0
  const hasCategoryScope = coupon.scopedCategories.length > 0

  if (!hasProductScope && !hasCategoryScope) return true

  return (
    (hasProductScope && coupon.scopedProductIds.includes(item.productId)) ||
    (hasCategoryScope && coupon.scopedCategories.includes(item.category))
  )
}

const capDiscount = (coupon: CouponRecord, amount: number): number =>
  coupon.maxDiscountAmount === null
    ? roundMoney(amount)
    : roundMoney(Math.min(amount, coupon.maxDiscountAmount))

/** Buy-one-get-one: every second unit of an eligible line is free. */
const computeBogoDiscount = (
  coupon: CouponRecord,
  eligibleItems: readonly DiscountCartItem[]
): number =>
  capDiscount(
    coupon,
    sumMoney(
      eligibleItems.map((item) =>
        multiplyMoney(item.unitPrice, Math.floor(item.quantity / 2))
      )
    )
  )

/**
 * Discount produced by a single coupon, ignoring caps that depend on other
 * coupons. Returns `0` when the coupon does not discount the cart value
 * (e.g. free shipping on a zero-cost shipping method).
 */
export const computeCouponDiscount = ({
  coupon,
  items,
  shippingAmount = 0,
}: {
  coupon: CouponRecord
  items: readonly DiscountCartItem[]
  shippingAmount?: number
}): number => {
  const eligibleItems = items.filter((item) => isInScope(coupon, item))
  const eligibleSubtotal = calculateSubtotal(eligibleItems)

  switch (coupon.discountType) {
    case 'PERCENTAGE': {
      const raw = convertMoney(eligibleSubtotal, coupon.discountValue / 100)
      return Math.min(capDiscount(coupon, raw), eligibleSubtotal)
    }
    case 'FIXED_AMOUNT':
      return Math.min(
        capDiscount(coupon, coupon.discountValue),
        eligibleSubtotal
      )
    case 'FREE_SHIPPING':
      return capDiscount(coupon, shippingAmount)
    case 'BOGO':
      return Math.min(
        computeBogoDiscount(coupon, eligibleItems),
        eligibleSubtotal
      )
  }
}

const assertRedeemable = ({
  coupon,
  code,
  subtotal,
  now,
  userRedemptionCount,
}: {
  coupon: CouponRecord
  code: string
  subtotal: number
  now: Date
  userRedemptionCount: number
}): void => {
  if (!coupon.isActive) {
    throw new CouponError(`Coupon ${code} is no longer active`)
  }
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new CouponError(`Coupon ${code} is not valid yet`)
  }
  if (coupon.endsAt && now > coupon.endsAt) {
    throw new CouponError(`Coupon ${code} has expired`)
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    throw new CouponError(`Coupon ${code} has reached its redemption limit`)
  }
  if (
    coupon.perUserLimit !== null &&
    userRedemptionCount >= coupon.perUserLimit
  ) {
    throw new CouponError(`Coupon ${code} has already been used`)
  }
  if (subtotal < coupon.minCartValue) {
    throw new CouponError(
      `Coupon ${code} requires a minimum cart value of ${coupon.minCartValue.toFixed(2)}`
    )
  }
}

/**
 * Validate a set of coupon codes against a server-priced cart and compute the
 * resulting discount.
 *
 * Stacking rule: a coupon flagged `stackable: false` may only be used on its
 * own. The total discount is clamped so an order total can never go negative.
 */
export const evaluateCoupons = ({
  codes,
  coupons,
  items,
  shippingAmount = 0,
  userRedemptionCounts = {},
  now = new Date(),
}: {
  codes: readonly string[]
  coupons: readonly CouponRecord[]
  items: readonly DiscountCartItem[]
  shippingAmount?: number
  userRedemptionCounts?: Readonly<Record<string, number>>
  now?: Date
}): DiscountBreakdown => {
  const subtotal = calculateSubtotal(items)
  const normalizedCodes = [
    ...new Set(codes.map(normalizeCouponCode).filter(Boolean)),
  ]

  if (normalizedCodes.length === 0) {
    return {
      subtotal,
      discountAmount: 0,
      shippingAmount,
      total: roundMoney(subtotal + shippingAmount),
      appliedCoupons: [],
    }
  }

  if (normalizedCodes.length > MAX_COUPONS_PER_CART) {
    throw new CouponError(
      `At most ${MAX_COUPONS_PER_CART} coupon codes can be applied`
    )
  }

  const byCode = new Map(
    coupons.map((coupon) => [normalizeCouponCode(coupon.code), coupon])
  )

  const selected = normalizedCodes.map((code) => {
    const coupon = byCode.get(code)
    if (!coupon) {
      throw new CouponError(`Coupon ${code} is not valid`, 404)
    }
    return { code, coupon }
  })

  if (selected.length > 1 && selected.some(({ coupon }) => !coupon.stackable)) {
    const blocking = selected.find(({ coupon }) => !coupon.stackable)
    throw new CouponError(
      `Coupon ${blocking?.code} cannot be combined with other coupons`
    )
  }

  const appliedCoupons: AppliedCoupon[] = []
  let remaining = subtotal
  let remainingShipping = shippingAmount

  for (const { code, coupon } of selected) {
    assertRedeemable({
      coupon,
      code,
      subtotal,
      now,
      userRedemptionCount: userRedemptionCounts[coupon.id] ?? 0,
    })

    const isShippingDiscount = coupon.discountType === 'FREE_SHIPPING'
    const budget = isShippingDiscount ? remainingShipping : remaining
    const discountAmount = Math.min(
      computeCouponDiscount({
        coupon,
        items,
        shippingAmount: remainingShipping,
      }),
      budget
    )

    if (isShippingDiscount) {
      remainingShipping = roundMoney(remainingShipping - discountAmount)
    } else {
      remaining = roundMoney(remaining - discountAmount)
    }

    appliedCoupons.push({
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountAmount,
      freeShipping: isShippingDiscount,
    })
  }

  const discountAmount = sumMoney(
    appliedCoupons.map((applied) => applied.discountAmount)
  )

  return {
    subtotal,
    discountAmount,
    shippingAmount: remainingShipping,
    total: roundMoney(subtotal + shippingAmount - discountAmount),
    appliedCoupons,
  }
}

/**
 * Load the referenced coupons plus the buyer's prior redemptions and evaluate
 * them against a server-priced cart.
 *
 * This is the only entry point used by the checkout path: the caller supplies
 * codes and database-priced line items, never an amount.
 */
export const resolveCartDiscount = async ({
  codes,
  items,
  userId,
  shippingAmount = 0,
  now = new Date(),
}: {
  codes: readonly string[]
  items: readonly DiscountCartItem[]
  userId: string
  shippingAmount?: number
  now?: Date
}): Promise<DiscountBreakdown> => {
  const normalizedCodes = [
    ...new Set(codes.map(normalizeCouponCode).filter(Boolean)),
  ]

  if (normalizedCodes.length === 0) {
    const subtotal = calculateSubtotal(items)
    return {
      subtotal,
      discountAmount: 0,
      shippingAmount,
      total: roundMoney(subtotal + shippingAmount),
      appliedCoupons: [],
    }
  }

  const records = await db.coupons.findManyByCodes(normalizedCodes)
  const userRedemptionCounts = await db.coupons.countUserRedemptions(
    userId,
    records.map((record) => record.id)
  )

  return evaluateCoupons({
    codes: normalizedCodes,
    coupons: records.map(toCouponRecord),
    items,
    shippingAmount,
    userRedemptionCounts,
    now,
  })
}
