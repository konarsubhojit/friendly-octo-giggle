/**
 * Single source of truth for order totals.
 *
 * Subtotal, shipping and tax are derived here and nowhere else, so the cart
 * summary, the order record, the confirmation email and the amount verified
 * against the payment provider can never drift apart.
 */
import { multiplyMoney, sumMoney } from '@/lib/money'
import {
  quoteShipping,
  type ShippableItem,
  type ShippingDestination,
  type ShippingMethodName,
  type ShippingQuote,
} from '@/lib/shipping'
import { calculateTax, type TaxBreakdown } from '@/lib/tax'

export interface PricedOrderItem extends ShippableItem {
  readonly price: number
  readonly quantity: number
}

export interface OrderTotals {
  readonly subtotal: number
  readonly shipping: ShippingQuote
  readonly tax: TaxBreakdown
  readonly total: number
}

export interface OrderTotalsInput {
  readonly items: readonly PricedOrderItem[]
  readonly destination: ShippingDestination & {
    readonly country?: string | null
  }
  readonly shippingMethod?: string | null
}

/** Merchandise total before shipping and tax. */
export const calculateSubtotal = (items: readonly PricedOrderItem[]): number =>
  sumMoney(items.map((item) => multiplyMoney(item.price, item.quantity)))

/**
 * Price a cart end to end. The grand total returned here is the amount that
 * must be captured by the payment provider.
 */
export const calculateOrderTotals = ({
  items,
  destination,
  shippingMethod,
}: OrderTotalsInput): OrderTotals => {
  const subtotal = calculateSubtotal(items)
  const shipping = quoteShipping({
    destination,
    items,
    subtotal,
    method: shippingMethod,
  })
  const tax = calculateTax({
    subtotal,
    shippingAmount: shipping.amount,
    destination,
  })

  return {
    subtotal,
    shipping,
    tax,
    total: sumMoney([subtotal, shipping.amount, tax.amount]),
  }
}

export type { ShippingMethodName }
