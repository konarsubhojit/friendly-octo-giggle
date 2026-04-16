'use client'

import { ProductVariant } from '@/lib/types'

interface VariationButtonProps {
  readonly variant: ProductVariant
  readonly label: string
  readonly isSelected: boolean
  readonly formatPrice: (amount: number) => string
  readonly onSelect: (variant: ProductVariant) => void
  readonly cartQuantity?: number
}

export function VariationButton({
  variant,
  label,
  isSelected,
  formatPrice,
  onSelect,
  cartQuantity = 0,
}: VariationButtonProps) {
  const className = isSelected
    ? 'p-4 border-2 rounded-xl transition-all duration-300 border-[var(--accent-warm)] bg-[var(--accent-cream)] shadow-warm scale-105'
    : 'p-4 border-2 rounded-xl transition-all duration-300 border-[var(--border-warm)] hover:border-[var(--accent-warm)] hover:shadow-warm hover:scale-105 bg-[var(--accent-cream)]/50'

  return (
    <button
      key={variant.id}
      onClick={() => onSelect(variant)}
      className={`${className} focus-warm`}
    >
      <div className="text-sm font-bold text-[var(--foreground)]">{label}</div>
      {variant.sku && (
        <div className="text-xs text-[var(--text-secondary)] mt-1">
          SKU: {variant.sku}
        </div>
      )}
      <div className="text-xs font-semibold text-[var(--accent-warm)] mt-1">
        {formatPrice(variant.price)}
      </div>
      {variant.stock > 0 && variant.stock < 6 && (
        <div className="text-xs text-[var(--accent-rose)] font-medium mt-1">
          Only {variant.stock} left
        </div>
      )}
      {cartQuantity > 0 && (
        <div className="text-xs font-semibold text-blue-600 mt-1">
          {cartQuantity} in cart
        </div>
      )}
    </button>
  )
}
