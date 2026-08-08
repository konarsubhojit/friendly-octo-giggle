/**
 * Coupon discount vocabulary.
 *
 * Declared here rather than in `features/cart/services/coupon-service.ts` so
 * client components (the admin coupon form) and Zod schemas can reference the
 * discount types without pulling the coupon service — and through it the
 * database and cache layers — into the browser bundle.
 */

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
