/**
 * Availability arithmetic shared by every read that gates on stock.
 *
 * On-hand stock and held units are two separate stored columns; availability is
 * always derived, never stored, so there is one definition of "can this be
 * bought" and no third column to keep in step.
 */

export interface StockLevels {
  readonly stock: number
  readonly reservedStock?: number | null
}

/**
 * Units a new shopper could still claim.
 *
 * Clamped at zero so a counter that has drifted above on-hand — which the
 * reservation service prevents, but which a manual database edit could
 * still produce — reads as "sold out" rather than as a negative quantity.
 */
export const availableUnits = (variant: StockLevels): number =>
  Math.max(0, variant.stock - (variant.reservedStock ?? 0))
