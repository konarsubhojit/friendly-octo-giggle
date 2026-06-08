'use client'

import Link from '@/components/ui/LocaleLink'
import { WishlistButton } from '@/features/wishlist/components/WishlistButton'

interface StickyMobileActionBarProps {
  readonly remainingStock: number
  readonly addingToCart: boolean
  readonly handleAddToCart: () => void
  readonly productId: string
  readonly productName: string
  readonly effectivePrice: number
  readonly quantity: number
  readonly quantityMessage: string
  readonly setQuantity: (q: number) => void
  readonly formatPrice: (amount: number) => string
}

/**
 * Sticky bottom action bar shown only on mobile (hidden on md+).
 * Provides quick Add-to-Cart + Wishlist access without scrolling.
 */
export const StickyMobileActionBar = ({
  remainingStock,
  addingToCart,
  handleAddToCart,
  productId,
  productName,
  effectivePrice,
  quantity,
  quantityMessage,
  setQuantity,
  formatPrice,
}: StickyMobileActionBarProps) => (
  <section
    aria-label="Quick actions"
    className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--surface)]/95 backdrop-blur-lg border-t border-[var(--border-warm)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
  >
    <div className="px-4 py-3 safe-bottom">
      <div className="flex items-center gap-3">
        {/* Wishlist toggle */}
        <div className="relative flex-shrink-0 w-11 h-11">
          <WishlistButton
            productId={productId}
            productName={productName}
            className="!static !w-11 !h-11 !top-auto !right-auto"
          />
        </div>

        {/* Price */}
        <span className="font-bold text-lg text-[var(--foreground)] flex-shrink-0">
          {formatPrice(effectivePrice * quantity)}
        </span>

        {/* Add to Cart */}
        <button
          onClick={handleAddToCart}
          disabled={addingToCart || remainingStock === 0}
          aria-disabled={addingToCart || remainingStock === 0}
          className="flex-1 min-tap rounded-xl bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white font-bold text-base shadow-warm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity focus-warm"
        >
          {(() => {
            if (remainingStock === 0) return 'Out of Stock'
            if (addingToCart) return 'Adding…'
            return 'Add to Cart'
          })()}
        </button>
      </div>

      {remainingStock > 0 && (
        <>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-[var(--foreground)]">
              <span>Quantity</span>
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                aria-label="Select quantity"
                aria-describedby={
                  quantityMessage ? 'mobile-quantity-message' : undefined
                }
                className="min-tap rounded-lg border-2 border-[var(--border-warm)] bg-[var(--surface)] px-3 text-base font-semibold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)] focus:border-transparent transition-colors"
              >
                {Array.from(
                  { length: Math.min(remainingStock, 10) },
                  (_, i) => i + 1
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <Link
              href="/cart"
              className="min-tap self-end rounded-xl bg-[var(--accent-blush)] px-5 font-bold text-[var(--text-secondary)] transition-all duration-300 hover:bg-[var(--accent-peach)]/50 focus-warm flex items-center justify-center"
            >
              View Cart
            </Link>
          </div>

          {quantityMessage && (
            <p
              id="mobile-quantity-message"
              className="mt-2 text-sm font-medium text-[var(--accent-rose)]"
            >
              {quantityMessage}
            </p>
          )}
        </>
      )}
    </div>
  </section>
)
