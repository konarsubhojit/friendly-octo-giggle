import { sumMoney } from '@/lib/money'
import {
  quoteShipping,
  type ShippingDestination,
  type ShippingMethodName,
} from '@/lib/shipping'
import { calculateTax } from '@/lib/tax'

interface ProductSummaryItem {
  readonly quantity?: number
  readonly product?: {
    readonly name: string
  } | null
}

interface CheckoutPriceItem {
  readonly quantity?: number
  readonly product?: {
    readonly name: string
  } | null
  readonly variant?: {
    readonly name?: string
    readonly sku?: string | null
    readonly price: number
    readonly weightGrams?: number | null
  } | null
  readonly customizationNote?: string | null
}

export interface CheckoutSummaryLineItem {
  readonly name: string
  readonly variantLabel: string | null
  readonly quantity: number
  readonly unitPrice: number
  readonly lineTotal: number
  readonly customizationNote: string | null
  readonly weightGrams: number | null
}

/**
 * Delivery context needed to price shipping and tax. Omitted on the cart page,
 * where the destination is still unknown.
 */
export interface CheckoutPricingContext {
  readonly destination?:
    | (ShippingDestination & {
        readonly country?: string | null
      })
    | null
  readonly shippingMethod?: string | null
}

export interface CheckoutPricingSummary {
  readonly itemCount: number
  readonly subtotal: number
  readonly shippingAmount: number
  readonly taxAmount: number
  readonly total: number
  /** Null until a destination is known (shipping is quoted at checkout). */
  readonly shippingMethod: ShippingMethodName | null
  /** False while the destination is unknown, so the UI can say "calculated at checkout". */
  readonly shippingQuoted: boolean
  readonly freeShippingApplied: boolean
}

function buildCheckoutPricingSummaryFromDerivedItems(
  lineItems: readonly CheckoutSummaryLineItem[],
  context: CheckoutPricingContext = {}
): CheckoutPricingSummary {
  const subtotal = sumMoney(lineItems.map((item) => item.lineTotal))
  const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0)
  const destination = context.destination

  if (!destination) {
    return {
      itemCount,
      subtotal,
      shippingAmount: 0,
      taxAmount: 0,
      total: subtotal,
      shippingMethod: null,
      shippingQuoted: false,
      freeShippingApplied: false,
    }
  }

  const shipping = quoteShipping({
    destination,
    items: lineItems.map((item) => ({
      quantity: item.quantity,
      weightGrams: item.weightGrams,
    })),
    subtotal,
    method: context.shippingMethod,
  })
  const tax = calculateTax({
    subtotal,
    shippingAmount: shipping.amount,
    destination,
  })

  return {
    itemCount,
    subtotal,
    shippingAmount: shipping.amount,
    taxAmount: tax.amount,
    total: sumMoney([subtotal, shipping.amount, tax.amount]),
    shippingMethod: shipping.method,
    shippingQuoted: true,
    freeShippingApplied: shipping.freeShippingApplied,
  }
}

function getUniqueProductNames(items: readonly ProductSummaryItem[]) {
  const names = items
    .map((item) => item.product?.name?.trim())
    .filter((name): name is string => Boolean(name))

  return [...new Set(names)]
}

export function summarizeOrderProducts(
  items: readonly ProductSummaryItem[],
  maxVisibleNames = 2
) {
  const productNames = getUniqueProductNames(items)

  if (productNames.length === 0) {
    return 'Order items unavailable'
  }

  const visibleNames = productNames.slice(0, Math.max(1, maxVisibleNames))
  const remainingCount = productNames.length - visibleNames.length

  if (remainingCount <= 0) {
    return visibleNames.join(', ')
  }

  return `${visibleNames.join(', ')} and ${remainingCount} more`
}

export function countOrderUnits(items: readonly ProductSummaryItem[]) {
  return items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
}

function getVariantLabel(item: CheckoutPriceItem) {
  const parts = [item.variant?.name, item.variant?.sku].filter(
    (value): value is string => Boolean(value)
  )

  if (parts.length === 0) {
    return null
  }

  return [...new Set(parts)].join(' - ')
}

export function buildCheckoutSummaryLineItems(
  items: readonly CheckoutPriceItem[]
): CheckoutSummaryLineItem[] {
  return items.map((item) => {
    const quantity = item.quantity ?? 0
    const unitPrice = item.variant?.price ?? 0

    return {
      name: item.product?.name ?? 'Product unavailable',
      variantLabel: getVariantLabel(item),
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      customizationNote: item.customizationNote ?? null,
      weightGrams: item.variant?.weightGrams ?? null,
    }
  })
}

export function buildCheckoutPricingSummary(
  items: readonly CheckoutPriceItem[],
  context?: CheckoutPricingContext
): CheckoutPricingSummary {
  const lineItems = buildCheckoutSummaryLineItems(items)

  return buildCheckoutPricingSummaryFromDerivedItems(lineItems, context)
}

export function buildCheckoutPricingSummaryFromLineItems(
  lineItems: readonly CheckoutSummaryLineItem[],
  context?: CheckoutPricingContext
): CheckoutPricingSummary {
  return buildCheckoutPricingSummaryFromDerivedItems(lineItems, context)
}
