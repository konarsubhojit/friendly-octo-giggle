'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CartItemWithProduct } from '@/lib/types'
import { CartItemRow } from '@/features/cart/components/CartItemRow'

interface CartProductGroupProps {
  readonly items: CartItemWithProduct[]
  readonly updating: string | null
  readonly customizationNotes: Record<string, string>
  readonly formatPrice: (amount: number) => string
  readonly onUpdateQuantity: (itemId: string, quantity: number) => void
  readonly onRemoveItem: (itemId: string) => void
  readonly onCustomizationChange: (itemId: string, note: string) => void
  readonly isLastGroup: boolean
}

export function CartProductGroup({
  items,
  updating,
  customizationNotes,
  formatPrice,
  onUpdateQuantity,
  onRemoveItem,
  onCustomizationChange,
  isLastGroup,
}: CartProductGroupProps) {
  if (items.length === 1) {
    return (
      <CartItemRow
        item={items[0]}
        isLast={isLastGroup}
        updating={updating}
        customizationNote={customizationNotes[items[0].id] || ''}
        formatPrice={formatPrice}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCustomizationChange={onCustomizationChange}
      />
    )
  }

  const product = items[0].product
  const productImage = items[0].variant?.image || product.image

  return (
    <div className={isLastGroup ? '' : 'border-b border-[var(--border-warm)]'}>
      <div className="flex gap-4 px-6 pt-5 pb-2 items-center">
        <div className="relative w-10 h-10 flex-shrink-0 bg-[var(--accent-cream)] rounded-lg overflow-hidden border border-[var(--border-warm)]">
          <Image
            src={productImage}
            alt={product.name}
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>
        <Link
          href={`/products/${product.id}`}
          className="text-sm font-bold text-[var(--foreground)] hover:text-[var(--accent-rose)] transition-colors truncate"
        >
          {product.name}
        </Link>
        <span className="ml-auto text-xs text-[var(--text-muted)] flex-shrink-0">
          {items.length} variants
        </span>
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          className={
            index < items.length - 1
              ? 'border-t border-[var(--border-warm)]/50'
              : ''
          }
        >
          <CartVariantRow
            item={item}
            updating={updating}
            customizationNote={customizationNotes[item.id] || ''}
            formatPrice={formatPrice}
            onUpdateQuantity={onUpdateQuantity}
            onRemoveItem={onRemoveItem}
            onCustomizationChange={onCustomizationChange}
          />
        </div>
      ))}
    </div>
  )
}

interface CartVariantRowProps {
  readonly item: CartItemWithProduct
  readonly updating: string | null
  readonly customizationNote: string
  readonly formatPrice: (amount: number) => string
  readonly onUpdateQuantity: (itemId: string, quantity: number) => void
  readonly onRemoveItem: (itemId: string) => void
  readonly onCustomizationChange: (itemId: string, note: string) => void
}

import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

const resolveVariantLabel = (item: CartItemWithProduct): string | null => {
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

const CartVariantRow = ({
  item,
  updating,
  customizationNote,
  formatPrice,
  onUpdateQuantity,
  onRemoveItem,
  onCustomizationChange,
}: CartVariantRowProps) => {
  const price = item.variant ? item.variant.price : 0
  const variantLabel = resolveVariantLabel(item)

  return (
    <div className="flex gap-4 px-6 py-4 items-start pl-16">
      <div className="flex-grow min-w-0">
        {variantLabel && (
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">
            {variantLabel}
          </p>
        )}
        <p className="text-base font-bold text-[var(--accent-rose)]">
          {formatPrice(price)}
        </p>

        <div className="flex items-center gap-3 mt-2">
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
                aria-label={`Quantity for ${item.product.name} ${variantLabel ?? ''}`}
                className="px-2 py-1.5 border border-[var(--border-warm)] rounded-lg text-sm font-semibold text-[var(--foreground)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {Array.from(
                  { length: Math.min(item.variant?.stock ?? 0, 10) },
                  (_, i) => i + 1
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

        <div className="mt-2">
          <input
            type="text"
            placeholder="Add customization note..."
            value={customizationNote}
            onChange={(e) => onCustomizationChange(item.id, e.target.value)}
            className="w-full text-xs px-3 py-2 border border-[var(--border-warm)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] bg-[var(--surface)]/50 placeholder-[var(--text-muted)] text-[var(--foreground)]"
            maxLength={500}
            aria-label={`Customization note for ${item.product.name} ${variantLabel ?? ''}`}
          />
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-base font-bold text-[var(--foreground)]">
          {formatPrice(price * item.quantity)}
        </p>
      </div>
    </div>
  )
}
