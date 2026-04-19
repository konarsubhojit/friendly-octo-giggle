import type { Product, ProductVariant, ProductOption } from '@/lib/types'
import type { CurrencyCode } from '@/lib/currency'
import {
  getVariantMinPrice,
  getVariantTotalStock,
} from '@/features/product/variant-utils'

const MAX_DESC_CHARS = 400

const truncate = (text: string, max = MAX_DESC_CHARS): string =>
  text.length <= max ? text : text.slice(0, max - 1) + '…'

interface BuildProductContextOptions {
  currencyCode?: CurrencyCode
  /** Formatter that receives the INR price and returns a display string in the target currency. */
  formatPrice?: (priceInINR: number) => string
}

const defaultFormatPrice = (priceInINR: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceInINR)

const sanitizeFormattedPrice = (value: string): string =>
  value.replace(/\u00a0/gu, ' ')

const stockLabel = (stock: number): string => {
  if (stock > 5) return 'In Stock'
  if (stock > 0) return 'Low Stock – limited availability'
  return 'Out of Stock'
}

/**
 * Build a human-readable label for a variant using its option values
 * (e.g. "Color: Red, Size: XL") instead of the raw SKU code.
 */
const variantLabel = (
  variant: ProductVariant,
  options?: ProductOption[]
): string => {
  if (variant.optionValues?.length && options?.length) {
    const optionMap = new Map(options.map((o) => [o.id, o.name]))
    return variant.optionValues
      .map((ov) => {
        const optionName = optionMap.get(ov.optionId)
        return optionName ? `${optionName}: ${ov.value}` : ov.value
      })
      .join(', ')
  }
  return variant.sku ?? 'Variant'
}

export const buildProductContext = (
  product: Product,
  options: BuildProductContextOptions = {}
): string => {
  const currencyCode = options.currencyCode ?? 'INR'
  const formatPrice = (price: number) =>
    sanitizeFormattedPrice((options.formatPrice ?? defaultFormatPrice)(price))

  const totalStock = getVariantTotalStock(product.variants)

  const lines: string[] = [
    `Name: ${product.name}`,
    `Category: ${product.category}`,
    `Description: ${truncate(product.description)}`,
    `Price (${currencyCode}): ${formatPrice(getVariantMinPrice(product.variants))}`,
    `Stock: ${stockLabel(totalStock)}`,
  ]

  if (product.variants?.length) {
    lines.push(`Variants (${product.variants.length}):`)
    for (const v of product.variants) {
      const label = variantLabel(v, product.options)
      lines.push(
        `- ${label}: ${formatPrice(v.price)}, ${stockLabel(v.stock).toLowerCase()}`
      )
    }
  }

  return lines.join('\n')
}

export const trimHistory = <T extends { role: string }>(
  messages: T[],
  maxMessages: number
): T[] => {
  if (messages.length <= maxMessages) return messages
  return messages.slice(-maxMessages)
}
