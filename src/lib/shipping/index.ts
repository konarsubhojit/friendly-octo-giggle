/**
 * Public entry point for the shipping-rate engine.
 *
 * Checkout, order creation and the admin exports all price shipping through
 * these helpers so a single rate table backs every surface.
 */
import { SHIPPING_METHODS, SHIPPING_METHOD_DEFINITIONS } from './methods'
import {
  quoteShipping,
  type ShippingQuote,
  type ShippingQuoteInput,
} from './rates'

export {
  SHIPPING_METHODS,
  SHIPPING_METHOD_DEFINITIONS,
  DEFAULT_SHIPPING_METHOD,
  isShippingMethod,
  toShippingMethod,
  getShippingMethodLabel,
} from './methods'
export type { ShippingMethodName, ShippingMethodDefinition } from './methods'

export {
  SHIPPING_ZONES,
  STORE_ORIGIN_STATE,
  resolveShippingZone,
  isIntraStateDestination,
  normalizeStateName,
} from './zones'
export type { ShippingZoneName, ShippingDestination } from './zones'

export {
  SHIPPING_ZONE_RATES,
  SHIPPING_WEIGHT_BAND_GRAMS,
  DEFAULT_ITEM_WEIGHT_GRAMS,
  calculateShipmentWeight,
  countWeightBands,
  quoteShipping,
} from './rates'
export type { ShippableItem, ShippingQuote, ShippingQuoteInput } from './rates'

/**
 * Quote every available method for a destination, so checkout can present the
 * customer with a priced choice rather than a single flat rate.
 */
export const quoteAllShippingMethods = (
  input: Omit<ShippingQuoteInput, 'method'>
): ShippingQuote[] =>
  SHIPPING_METHODS.map((method) => quoteShipping({ ...input, method }))

/** Customer-facing option list combining the quote with its method copy. */
export interface ShippingMethodOption extends ShippingQuote {
  readonly label: string
  readonly description: string
}

export const buildShippingMethodOptions = (
  input: Omit<ShippingQuoteInput, 'method'>
): ShippingMethodOption[] =>
  quoteAllShippingMethods(input).map((quote) => ({
    ...quote,
    label: SHIPPING_METHOD_DEFINITIONS[quote.method].label,
    description: SHIPPING_METHOD_DEFINITIONS[quote.method].description,
  }))
