/**
 * Shipping methods offered at checkout.
 *
 * This module is intentionally dependency-free (no env, no db, no network) so
 * it can be imported from schema definitions, validation schemas, edge code and
 * client bundles, mirroring `@/lib/payments/providers`.
 */
export const SHIPPING_METHODS = ['STANDARD', 'EXPRESS'] as const

export type ShippingMethodName = (typeof SHIPPING_METHODS)[number]

export const DEFAULT_SHIPPING_METHOD: ShippingMethodName = 'STANDARD'

export interface ShippingMethodDefinition {
  /** Customer-facing name. */
  readonly label: string
  /** Short explanation shown under the label at checkout. */
  readonly description: string
  /** Multiplier applied to the zone's base and per-band rates. */
  readonly rateMultiplier: number
  /** Days added to the zone's transit estimate. */
  readonly transitDaysAdjustment: number
  /** Whether the free-shipping threshold can zero out this method. */
  readonly eligibleForFreeShipping: boolean
}

export const SHIPPING_METHOD_DEFINITIONS: Record<
  ShippingMethodName,
  ShippingMethodDefinition
> = {
  STANDARD: {
    label: 'Standard delivery',
    description: 'Delivered by our regular courier partners.',
    rateMultiplier: 1,
    transitDaysAdjustment: 0,
    eligibleForFreeShipping: true,
  },
  EXPRESS: {
    label: 'Express delivery',
    description: 'Priority handling and a faster courier service.',
    rateMultiplier: 2.5,
    transitDaysAdjustment: -2,
    eligibleForFreeShipping: false,
  },
}

export const isShippingMethod = (value: unknown): value is ShippingMethodName =>
  typeof value === 'string' &&
  (SHIPPING_METHODS as readonly string[]).includes(value)

/** Resolve a persisted/user-supplied method, falling back to the default. */
export const toShippingMethod = (value: unknown): ShippingMethodName =>
  isShippingMethod(value) ? value : DEFAULT_SHIPPING_METHOD

export const getShippingMethodLabel = (value: unknown): string =>
  isShippingMethod(value)
    ? SHIPPING_METHOD_DEFINITIONS[value].label
    : SHIPPING_METHOD_DEFINITIONS[DEFAULT_SHIPPING_METHOD].label
