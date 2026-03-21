"use client";

import { ProductVariation } from "@/lib/types";

interface VariationButtonProps {
  readonly variation: ProductVariation;
  readonly isSelected: boolean;
  readonly formatPrice: (amount: number) => string;
  readonly onSelect: (variation: ProductVariation) => void;
  readonly cartQuantity?: number;
}

export function VariationButton({
  variation,
  isSelected,
  formatPrice,
  onSelect,
  cartQuantity = 0,
}: VariationButtonProps) {
  const className = isSelected
    ? "p-4 border-2 rounded-xl transition-all duration-300 border-[var(--accent-warm)] bg-[var(--accent-cream)] shadow-warm scale-105"
    : "p-4 border-2 rounded-xl transition-all duration-300 border-[var(--border-warm)] hover:border-[var(--accent-warm)] hover:shadow-warm hover:scale-105 bg-[var(--accent-cream)]/50";

  return (
    <button
      key={variation.id}
      onClick={() => onSelect(variation)}
      className={`${className} focus-warm`}
    >
      <div className="text-sm font-bold text-[var(--foreground)]">
        {variation.designName}
      </div>
      <div className="text-xs text-[var(--text-secondary)] mt-1">
        {variation.name}
      </div>
      {variation.priceModifier !== 0 && (
        <div className="text-xs font-semibold text-[var(--accent-rose)] mt-1">
          {variation.priceModifier > 0 ? "+" : "-"}
          {formatPrice(Math.abs(variation.priceModifier))}
        </div>
      )}
      {variation.stock > 0 && variation.stock < 6 && (
        <div className="text-xs text-[var(--accent-rose)] font-medium mt-1">
          Only {variation.stock} left
        </div>
      )}
      {cartQuantity > 0 && (
        <div className="text-xs font-semibold text-blue-600 mt-1">
          {cartQuantity} in cart
        </div>
      )}
    </button>
  );
}
