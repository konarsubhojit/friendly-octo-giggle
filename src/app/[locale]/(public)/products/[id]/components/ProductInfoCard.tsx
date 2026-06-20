import { Product, ProductVariant } from '@/lib/types'
import { StockBadge } from '@/features/product/components/StockBadge'
import { ShareButton } from '@/features/product/components/ShareButton'
import { VariantSelector } from './VariantSelector'

interface PriceModifierDisplayProps {
  readonly selectedVariant: ProductVariant | null
}

const PriceModifierDisplay = ({
  selectedVariant,
}: PriceModifierDisplayProps) => {
  if (!selectedVariant) return null
  return (
    <div className="mt-2 text-sm text-[var(--text-secondary)]">
      Variant price
    </div>
  )
}

interface ProductInfoCardProps {
  readonly product: Product
  readonly formatPrice: (amount: number) => string
  readonly effectivePrice: number
  readonly selectedVariant: ProductVariant | null
  readonly setSelectedVariant: (v: ProductVariant | null) => void
  readonly effectiveStock: number
  readonly cartQuantities: Record<string, number>
}

export const ProductInfoCard = ({
  product,
  formatPrice,
  effectivePrice,
  selectedVariant,
  setSelectedVariant,
  effectiveStock,
  cartQuantities,
}: ProductInfoCardProps) => {
  return (
    <div className="mb-6 rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/80 p-6 shadow-warm backdrop-blur-lg sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-3xl font-display font-bold italic text-warm-heading sm:text-4xl">
          {product.name}
        </h1>
        <ShareButton
          productId={product.id}
          variantId={selectedVariant?.id ?? null}
        />
      </div>

      <div className="mb-6">
        <span className="inline-block bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-full px-4 py-2 text-sm font-semibold shadow-warm">
          {product.category}
        </span>
      </div>

      <p className="text-[var(--text-secondary)] text-lg mb-8 leading-relaxed">
        {product.description}
      </p>

      <div className="mb-6 rounded-xl border border-[var(--border-warm)] bg-gradient-to-r from-[var(--accent-blush)] to-[var(--border-warm)] p-4">
        <span className="text-4xl font-bold text-warm-heading sm:text-5xl">
          {formatPrice(effectivePrice)}
        </span>
        <PriceModifierDisplay selectedVariant={selectedVariant} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StockBadge stock={effectiveStock} showIcon size="md" />
        <output
          className="inline-flex items-center rounded-full bg-[var(--accent-cream)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] shadow-warm"
          aria-label={`Total units sold: ${product.soldCount ?? 0}`}
        >
          {product.soldCount ?? 0} Sold
        </output>
      </div>

      <VariantSelector
        product={product}
        selectedVariant={selectedVariant}
        formatPrice={formatPrice}
        onSelect={setSelectedVariant}
        cartQuantities={cartQuantities}
      />
    </div>
  )
}
