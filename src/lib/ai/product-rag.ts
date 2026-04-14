import type { Product } from '@/lib/types'
import type { CurrencyCode } from '@/lib/currency'

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
  value.replace(/\u00a0/g, ' ')

export const buildProductContext = (
  product: Product,
  options: BuildProductContextOptions = {}
): string => {
  const currencyCode = options.currencyCode ?? 'INR'
  const formatPrice = (price: number) =>
    sanitizeFormattedPrice((options.formatPrice ?? defaultFormatPrice)(price))

  const lines: string[] = [
    `Name: ${product.name}`,
    `Category: ${product.category}`,
    `Description: ${truncate(product.description)}`,
    `Price (${currencyCode}): ${formatPrice(Math.min(...(product.variants?.map(v => v.price) ?? [0])))}`,
    `Stock: ${(product.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0) > 0 ? (product.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0) + ' units' : 'Out of stock'}`,
  ]

  if (product.variants?.length) {
    lines.push(`Variants (${product.variants.length}):`)
    for (const v of product.variants) {
      const stock = v.stock > 0 ? `${v.stock} in stock` : 'out of stock'
      lines.push(
        `- ${v.sku ?? 'Variant'}: ${formatPrice(v.price)}, ${stock}`
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
