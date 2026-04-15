/**
 * Shared utilities for deriving aggregate product metrics from variants.
 *
 * These are used across admin tables, shop grids, wishlist, product detail,
 * AI context generation, and tests.
 */

interface HasPrice {
  readonly price: number
}

interface HasStock {
  readonly stock: number
}

/**
 * Returns the lowest price among the given variants, or `0` when the list is
 * empty / undefined.
 */
export function getVariantMinPrice(
  variants: readonly HasPrice[] | undefined | null
): number {
  if (!variants || variants.length === 0) return 0
  return Math.min(...variants.map((v) => v.price))
}

/**
 * Returns the sum of stock across all variants, or `0` when the list is
 * empty / undefined.
 */
export function getVariantTotalStock(
  variants: readonly HasStock[] | undefined | null
): number {
  if (!variants || variants.length === 0) return 0
  return variants.reduce((sum, v) => sum + v.stock, 0)
}

/**
 * Returns the first variant that is in stock, falling back to the first
 * variant overall (useful for QuickAdd where we need *some* variant to select).
 * Returns `null` when no variants exist.
 */
export function getFirstInStockVariant<T extends HasStock>(
  variants: readonly T[] | undefined | null
): T | null {
  if (!variants || variants.length === 0) return null
  return variants.find((v) => v.stock > 0) ?? variants[0]
}
