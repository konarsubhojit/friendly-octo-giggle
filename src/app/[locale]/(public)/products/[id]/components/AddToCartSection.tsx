'use client'

import Link from '@/components/ui/LocaleLink'
import { CartStatusAlerts } from './CartStatusAlerts'

const AddingSpinner = () => (
  <span className="flex items-center justify-center gap-2">
    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    Adding...
  </span>
)

const CartButtonLabel = () => (
  <span className="flex items-center justify-center gap-2">
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
    Add to Cart
  </span>
)

interface AddToCartSectionProps {
  readonly error: string
  readonly cartSuccess: boolean
  readonly stockWarning: string
  readonly quantity: number
  readonly quantityMessage: string
  readonly setQuantity: (q: number) => void
  readonly effectiveStock: number
  readonly effectivePrice: number
  readonly addingToCart: boolean
  readonly handleAddToCart: () => void
  readonly formatPrice: (amount: number) => string
  readonly currentCartQuantity: number
  readonly showAlerts?: boolean
}

export const AddToCartSection = ({
  error,
  cartSuccess,
  stockWarning,
  quantity,
  quantityMessage,
  setQuantity,
  effectiveStock,
  effectivePrice,
  addingToCart,
  handleAddToCart,
  formatPrice,
  currentCartQuantity,
  showAlerts = true,
}: AddToCartSectionProps) => {
  return (
    <div className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/80 p-6 shadow-warm backdrop-blur-lg sm:p-8">
      {showAlerts && (
        <CartStatusAlerts
          currentCartQuantity={currentCartQuantity}
          error={error}
          cartSuccess={cartSuccess}
          stockWarning={stockWarning}
        />
      )}

      <div className="mb-5">
        <label
          htmlFor="quantity-input"
          className="block text-sm font-semibold text-[var(--foreground)] mb-2"
        >
          Quantity
        </label>
        <select
          id="quantity-input"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          aria-label="Select quantity"
          aria-describedby={quantityMessage ? 'quantity-message' : undefined}
          className="w-full px-3 py-2.5 border-2 border-[var(--border-warm)] rounded-lg text-base font-semibold text-[var(--foreground)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)] focus:border-transparent transition-colors cursor-pointer"
        >
          {Array.from(
            { length: Math.min(effectiveStock, 10) },
            (_, i) => i + 1
          ).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {quantityMessage && (
          <p
            id="quantity-message"
            className="mt-1.5 text-sm font-medium text-[var(--accent-rose)] flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            {quantityMessage}
          </p>
        )}
      </div>

      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-[var(--accent-blush)] to-[var(--border-warm)] p-3">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">
          Total:
        </span>
        <span className="text-right text-xl font-bold bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] bg-clip-text text-transparent sm:text-2xl">
          {formatPrice(effectivePrice * quantity)}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleAddToCart}
          disabled={addingToCart}
          className="flex-1 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white py-4 rounded-xl font-bold text-lg hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-warm hover:shadow-warm-lg focus-warm"
        >
          {addingToCart ? <AddingSpinner /> : <CartButtonLabel />}
        </button>

        <Link
          href="/cart"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-blush)] px-5 py-4 font-bold text-[var(--text-secondary)] transition-all duration-300 hover:bg-[var(--accent-peach)]/50 focus-warm sm:w-auto sm:flex-shrink-0"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          View Cart
        </Link>
      </div>
    </div>
  )
}
