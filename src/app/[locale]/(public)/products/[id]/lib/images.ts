import { Product, ProductVariant } from '@/lib/types'

export const getVariantImages = (variant: ProductVariant): string[] =>
  [...(variant.image ? [variant.image] : []), ...(variant.images ?? [])].filter(
    Boolean
  )

export const getProductImages = (product: Product): string[] =>
  [product.image, ...(product.images ?? [])].filter(Boolean)

export const getCarouselImages = (
  product: Product,
  selectedVariant: ProductVariant | null
): string[] => {
  if (selectedVariant) {
    const imgs = getVariantImages(selectedVariant)
    if (imgs.length > 0) return imgs
  }
  return getProductImages(product)
}
