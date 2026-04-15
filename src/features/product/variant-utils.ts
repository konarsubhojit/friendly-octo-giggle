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
