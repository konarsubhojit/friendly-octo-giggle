/**
 * Zone- and weight-based shipping rate calculation.
 *
 * Rates are expressed as a base charge covering the first weight band plus a
 * surcharge for every additional band, multiplied by the chosen method. All
 * arithmetic goes through `@/lib/money` so the quoted amount reconciles exactly
 * with the amount captured by the payment provider.
 */
import { roundMoney, sumMoney } from '@/lib/money'
import {
  DEFAULT_SHIPPING_METHOD,
  SHIPPING_METHOD_DEFINITIONS,
  type ShippingMethodName,
  toShippingMethod,
} from './methods'
import {
  resolveShippingZone,
  type ShippingDestination,
  type ShippingZoneName,
} from './zones'

/** Weight covered by the base rate, and by each additional band. */
export const SHIPPING_WEIGHT_BAND_GRAMS = 500

/** Assumed weight of a unit that has no recorded weight. */
export const DEFAULT_ITEM_WEIGHT_GRAMS = 250

export interface ShippingZoneRate {
  /** Charge covering the first weight band. */
  readonly baseRate: number
  /** Charge added for each additional (part-)band. */
  readonly additionalBandRate: number
  /** Order subtotal at or above which standard shipping is free. */
  readonly freeShippingThreshold: number
  /** Indicative transit time shown at checkout. */
  readonly estimatedDays: number
}

export const SHIPPING_ZONE_RATES: Record<ShippingZoneName, ShippingZoneRate> = {
  LOCAL: {
    baseRate: 29,
    additionalBandRate: 10,
    freeShippingThreshold: 799,
    estimatedDays: 3,
  },
  REGIONAL: {
    baseRate: 49,
    additionalBandRate: 18,
    freeShippingThreshold: 999,
    estimatedDays: 5,
  },
  NATIONAL: {
    baseRate: 69,
    additionalBandRate: 25,
    freeShippingThreshold: 1499,
    estimatedDays: 7,
  },
  REMOTE: {
    baseRate: 119,
    additionalBandRate: 40,
    freeShippingThreshold: 2499,
    estimatedDays: 10,
  },
}

export interface ShippableItem {
  readonly quantity: number
  readonly weightGrams?: number | null
}

export interface ShippingQuote {
  readonly method: ShippingMethodName
  readonly zone: ShippingZoneName
  readonly amount: number
  readonly billableWeightGrams: number
  readonly freeShippingApplied: boolean
  /** Subtotal that would make standard shipping free, or null when ineligible. */
  readonly freeShippingThreshold: number | null
  readonly estimatedDays: number
}

/**
 * Total billable weight of a cart. Items without a recorded weight fall back to
 * `DEFAULT_ITEM_WEIGHT_GRAMS` so a quote is always produced.
 */
export const calculateShipmentWeight = (
  items: readonly ShippableItem[]
): number =>
  items.reduce((total, item) => {
    const quantity =
      Number.isFinite(item.quantity) && item.quantity > 0
        ? Math.floor(item.quantity)
        : 0
    const weight =
      typeof item.weightGrams === 'number' &&
      Number.isFinite(item.weightGrams) &&
      item.weightGrams > 0
        ? item.weightGrams
        : DEFAULT_ITEM_WEIGHT_GRAMS

    return total + quantity * weight
  }, 0)

/** Number of weight bands charged for a shipment (always at least one). */
export const countWeightBands = (weightGrams: number): number =>
  Math.max(1, Math.ceil(weightGrams / SHIPPING_WEIGHT_BAND_GRAMS))

export interface ShippingQuoteInput {
  readonly destination: ShippingDestination
  readonly items: readonly ShippableItem[]
  /** Merchandise subtotal, used for the free-shipping threshold. */
  readonly subtotal: number
  readonly method?: string | null
}

/** Quote a single shipping method for a destination and cart. */
export const quoteShipping = ({
  destination,
  items,
  subtotal,
  method,
}: ShippingQuoteInput): ShippingQuote => {
  const resolvedMethod = toShippingMethod(method ?? DEFAULT_SHIPPING_METHOD)
  const definition = SHIPPING_METHOD_DEFINITIONS[resolvedMethod]
  const zone = resolveShippingZone(destination)
  const zoneRate = SHIPPING_ZONE_RATES[zone]

  const billableWeightGrams = calculateShipmentWeight(items)
  const additionalBands = countWeightBands(billableWeightGrams) - 1

  const grossAmount = roundMoney(
    sumMoney([
      zoneRate.baseRate,
      roundMoney(zoneRate.additionalBandRate * additionalBands),
    ]) * definition.rateMultiplier
  )

  const freeShippingApplied =
    definition.eligibleForFreeShipping &&
    subtotal >= zoneRate.freeShippingThreshold

  return {
    method: resolvedMethod,
    zone,
    amount: freeShippingApplied ? 0 : grossAmount,
    billableWeightGrams,
    freeShippingApplied,
    freeShippingThreshold: definition.eligibleForFreeShipping
      ? zoneRate.freeShippingThreshold
      : null,
    estimatedDays: Math.max(
      1,
      zoneRate.estimatedDays + definition.transitDaysAdjustment
    ),
  }
}
