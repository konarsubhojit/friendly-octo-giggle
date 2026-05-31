import Link from '@/components/ui/LocaleLink'

interface OutOfStockPanelProps {
  readonly currentCartQuantity: number
}

export const OutOfStockPanel = ({
  currentCartQuantity,
}: OutOfStockPanelProps) => (
  <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
    {currentCartQuantity > 0 ? (
      <>
        <div className="flex items-center gap-3 text-blue-600">
          <svg
            className="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span className="text-lg font-bold">All Available Stock in Cart</span>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          You have all {currentCartQuantity} available{' '}
          {currentCartQuantity === 1 ? 'item' : 'items'} in your cart. No more
          can be added.
        </p>
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-xl font-semibold text-sm shadow-warm hover:shadow-warm-lg transition-all duration-300 focus-warm"
        >
          Go to Cart
        </Link>
      </>
    ) : (
      <>
        <div className="flex items-center gap-3 text-red-500">
          <svg
            className="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          <span className="text-lg font-bold">Out of Stock</span>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This item is currently unavailable. Check back later or explore other
          products.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-xl font-semibold text-sm shadow-warm hover:shadow-warm-lg transition-all duration-300 focus-warm"
        >
          Browse Products
        </Link>
      </>
    )}
  </div>
)
