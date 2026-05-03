import type { CartItemWithProduct } from '@/lib/types'

export const resolveVariantLabel = (
  item: CartItemWithProduct
): string | null => {
  if (item.variantLabel) return item.variantLabel
  if (!item.variant) return null
  const { optionValues } = item.variant
  const options = item.product.options
  if (optionValues?.length && options?.length) {
    const optionNameMap = new Map(options.map((opt) => [opt.id, opt.name]))
    const parts = optionValues
      .map((ov) => {
        const name = optionNameMap.get(ov.optionId)
        return name ? `${name}: ${ov.value}` : ov.value
      })
      .filter(Boolean)
    if (parts.length > 0) return parts.join(' / ')
  }
  return item.variant.sku ?? null
}
