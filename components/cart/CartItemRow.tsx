'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CartItemWithProduct } from '@/lib/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface CartItemRowProps {
  readonly item: CartItemWithProduct;
  readonly isLast: boolean;
  readonly updating: string | null;
  readonly customizationNote: string;
  readonly formatPrice: (amount: number) => string;
  readonly onUpdateQuantity: (itemId: string, quantity: number) => void;
  readonly onRemoveItem: (itemId: string) => void;
  readonly onCustomizationChange: (itemId: string, note: string) => void;
}

export function CartItemRow({
  item,
  isLast,
  updating,
  customizationNote,
  formatPrice,
  onUpdateQuantity,
  onRemoveItem,
  onCustomizationChange,
}: CartItemRowProps) {
  const price = item.variation
    ? item.product.price + item.variation.priceModifier
    : item.product.price;
  const image = item.variation?.image || item.product.image;

  return (
    <div className={`flex gap-5 p-6 items-start${isLast ? '' : ' border-b border-gray-100'}`}>
      <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
        <Image src={image} alt={item.product.name} fill sizes="80px" className="object-cover" />
      </div>

      <div className="flex-grow min-w-0">
        <Link
          href={`/products/${item.productId}`}
          className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors block truncate"
        >
          {item.product.name}
        </Link>
        {item.variation && (
          <p className="text-xs text-gray-500 mt-0.5">
            {item.variation.designName} - {item.variation.name}
          </p>
        )}
        <p className="text-lg font-bold text-gray-900 mt-1">{formatPrice(price)}</p>

        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={updating === item.id || item.quantity <= 1}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              -
            </button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900">
              {updating === item.id ? (
                <LoadingSpinner size="h-4 w-4" color="text-blue-500" />
              ) : (
                item.quantity
              )}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              disabled={updating === item.id}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>

          <button
            onClick={() => onRemoveItem(item.id)}
            disabled={updating === item.id}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40 transition-colors"
          >
            Remove
          </button>
        </div>

        <div className="mt-3">
          <input
            type="text"
            placeholder="Add customization note (e.g., color preference, message on card...)"
            value={customizationNote}
            onChange={(e) => onCustomizationChange(item.id, e.target.value)}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white/50 placeholder-gray-400"
            maxLength={500}
            aria-label={`Customization note for ${item.product.name}`}
          />
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-lg font-bold text-gray-900">{formatPrice(price * item.quantity)}</p>
      </div>
    </div>
  );
}
