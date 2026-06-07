'use client'

import { ProductVariant } from '@/lib/types'

interface VariantButtonProps {
  readonly variant: ProductVariant
  readonly label: string
  readonly isSelected: boolean
  readonly formatPrice: (amount: number) => string
  readonly onSelect: (variant: ProductVariant) => void
  readonly cartQuantity?: number
}

export function VariantButton({
  variant,
  label,
  isSelected,
  formatPrice,
  onSelect,
  cartQuantity = 0,
}: VariantButtonProps) {
  const isOutOfStock = variant.stock === 0

  const getBaseClass = () => {
    if (isOutOfStock) {
      return isSelected
        ? 'p-4 border-2 rounded-xl transition-all duration-300 border-[var(--border-warm)] bg-gray-100 opacity-60 cursor-not-allowed'
        : 'p-4 border-2 rounded-xl transition-all duration-300 border-[var(--border-warm)] bg-gray-50 opacity-50 cursor-not-allowed'
    }
    return isSelected
      ? 'p-4 border-2 rounded-xl transition-all duration-300 border-[var(--accent-warm)] bg-[var(--accent-cream)] shadow-warm scale-105'
      : 'p-4 border-2 rounded-xl transition-all duration-300 border-[var(--border-warm)] hover:border-[var(--accent-warm)] hover:shadow-warm hover:scale-105 bg-[var(--accent-cream)]/50'
  }
  const baseClass = getBaseClass()

  return (
    <button
      onClick={() => !isOutOfStock && onSelect(variant)}
      disabled={isOutOfStock}
      aria-disabled={isOutOfStock}
      aria-label={isOutOfStock ? `${label} — Out of stock` : label}
      className={`${baseClass} focus-warm text-left`}
    >
      <div
        className={`text-sm font-bold ${isOutOfStock ? 'text-[var(--text-muted)] line-through' : 'text-[var(--foreground)]'}`}
      >
        {label}
      </div>
      {variant.sku && !isOutOfStock && (
        <div className="text-xs text-[var(--text-secondary)] mt-1">
          SKU: {variant.sku}
        </div>
      )}
      {isOutOfStock ? (
        <div className="text-xs font-semibold text-red-500 mt-1">
          Out of stock
        </div>
      ) : (
        <div className="text-xs font-semibold text-[var(--accent-warm)] mt-1">
          {formatPrice(variant.price)}
        </div>
      )}
      {!isOutOfStock && variant.stock > 0 && variant.stock < 6 && (
        <div className="text-xs text-[var(--accent-rose)] font-medium mt-1">
          Only {variant.stock} left
        </div>
      )}
      {cartQuantity > 0 && !isOutOfStock && (
        <div className="text-xs font-semibold text-blue-600 mt-1">
          {cartQuantity} in cart
        </div>
      )}
    </button>
  )
}
