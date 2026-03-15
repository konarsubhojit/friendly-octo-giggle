'use client';

import { ProductVariation } from '@/lib/types';

interface VariationButtonProps {
  readonly variation: ProductVariation;
  readonly isSelected: boolean;
  readonly formatPrice: (amount: number) => string;
  readonly onSelect: (variation: ProductVariation) => void;
}

export function VariationButton({ variation, isSelected, formatPrice, onSelect }: VariationButtonProps) {
  const className = isSelected
    ? 'p-4 border-2 rounded-xl transition-all duration-300 border-blue-600 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 shadow-lg scale-105'
    : 'p-4 border-2 rounded-xl transition-all duration-300 border-gray-300 hover:border-blue-400 hover:shadow-md hover:scale-105 bg-white dark:bg-gray-800 dark:border-gray-600';

  return (
    <button key={variation.id} onClick={() => onSelect(variation)} className={className}>
      <div className="text-sm font-bold text-gray-800 dark:text-gray-100">{variation.designName}</div>
      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{variation.name}</div>
      {variation.priceModifier !== 0 && (
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
          {variation.priceModifier > 0 ? '+' : '-'}{formatPrice(Math.abs(variation.priceModifier))}
        </div>
      )}
      {variation.stock > 0 && variation.stock < 6 && (
        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">Only {variation.stock} left</div>
      )}
    </button>
  );
}
