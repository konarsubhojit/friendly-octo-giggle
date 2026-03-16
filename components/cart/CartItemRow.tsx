"use client";

import Link from "next/link";
import Image from "next/image";
import { CartItemWithProduct } from "@/lib/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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
    <div
      className={`flex gap-5 p-6 items-start${isLast ? "" : " border-b border-[var(--border-warm)]"}`}
    >
      <div className="relative w-24 h-24 flex-shrink-0 bg-[var(--accent-cream)] rounded-xl overflow-hidden border border-[var(--border-warm)]">
        <Image
          src={image}
          alt={item.product.name}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>

      <div className="flex-grow min-w-0">
        <Link
          href={`/products/${item.productId}`}
          className="text-base font-bold text-[var(--foreground)] hover:text-[var(--accent-rose)] transition-colors block truncate"
        >
          {item.product.name}
        </Link>
        {item.variation && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {item.variation.designName} - {item.variation.name}
          </p>
        )}
        <p className="text-lg font-bold text-[var(--accent-rose)] mt-1">
          {formatPrice(price)}
        </p>

        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor={`qty-${item.id}`}
              className="text-xs font-semibold text-[var(--text-secondary)]"
            >
              Qty:
            </label>
            {updating === item.id ? (
              <LoadingSpinner
                size="h-4 w-4"
                color="text-[var(--accent-warm)]"
              />
            ) : (
              <select
                id={`qty-${item.id}`}
                value={item.quantity}
                onChange={(e) =>
                  onUpdateQuantity(item.id, Number(e.target.value))
                }
                disabled={updating === item.id}
                aria-label={`Quantity for ${item.product.name}`}
                className="px-2 py-1.5 border border-[var(--border-warm)] rounded-lg text-sm font-semibold text-[var(--foreground)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {Array.from(
                  {
                    length: Math.min(
                      item.variation?.stock ?? item.product.stock,
                      10,
                    ),
                  },
                  (_, i) => i + 1,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => onRemoveItem(item.id)}
            disabled={updating === item.id}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40 transition-colors focus-warm rounded"
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
            className="w-full text-xs px-3 py-2 border border-[var(--border-warm)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] bg-[var(--surface)]/50 placeholder-[var(--text-muted)] text-[var(--foreground)]"
            maxLength={500}
            aria-label={`Customization note for ${item.product.name}`}
          />
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-lg font-bold text-[var(--foreground)]">
          {formatPrice(price * item.quantity)}
        </p>
      </div>
    </div>
  );
}
