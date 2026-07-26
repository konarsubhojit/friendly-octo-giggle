import type { CheckoutPricingSummary } from '@/features/orders/services/order-summary'

interface CartPricingSummaryProps {
  readonly summary: CheckoutPricingSummary
  readonly formatPrice: (amount: number) => string
  readonly subtotalLabel?: string
  readonly shippingLabel?: string
  readonly taxLabel?: string
  readonly discountLabel?: string
  readonly totalLabel?: string
  /** Coupon discount applied to the order; omit or pass 0 when none. */
  readonly discountAmount?: number | null
  readonly className?: string
}

/** Shipping copy: free, quoted, or still awaiting a delivery address. */
function formatShipping(
  summary: CheckoutPricingSummary,
  formatPrice: (amount: number) => string
): string {
  if (!summary.shippingQuoted) return 'Calculated at checkout'
  if (summary.shippingAmount === 0) return 'Free'
  return formatPrice(summary.shippingAmount)
}

export function CartPricingSummary({
  summary,
  formatPrice,
  subtotalLabel = 'Subtotal',
  shippingLabel = 'Shipping',
  taxLabel = 'Tax (GST)',
  discountLabel = 'Discount',
  totalLabel = 'Total',
  discountAmount,
  className,
}: CartPricingSummaryProps) {
  const { itemCount } = summary
  const discount = discountAmount && discountAmount > 0 ? discountAmount : 0
  // The discount never takes the payable amount below zero.
  const total = Math.max(0, summary.total - discount)

  return (
    <div className={className ?? 'space-y-3 text-sm'}>
      <div className="flex justify-between text-[var(--text-secondary)]">
        <span>
          {subtotalLabel} ({itemCount} {itemCount === 1 ? 'item' : 'items'})
        </span>
        <span className="font-medium">{formatPrice(summary.subtotal)}</span>
      </div>
      <div className="flex justify-between text-[var(--text-secondary)]">
        <span>{shippingLabel}</span>
        <span className="text-[var(--accent-sage)] font-medium">
          {formatShipping(summary, formatPrice)}
        </span>
      </div>
      {summary.shippingQuoted && (
        <div className="flex justify-between text-[var(--text-secondary)]">
          <span>{taxLabel}</span>
          <span className="font-medium">{formatPrice(summary.taxAmount)}</span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between text-[var(--text-secondary)]">
          <span>{discountLabel}</span>
          <span className="text-[var(--accent-sage)] font-medium">
            -{formatPrice(discount)}
          </span>
        </div>
      )}
      <div className="border-t border-[var(--border-warm)] pt-3 flex justify-between">
        <span className="font-bold text-[var(--foreground)]">{totalLabel}</span>
        <span className="text-xl font-bold text-warm-heading">
          {formatPrice(total)}
        </span>
      </div>
    </div>
  )
}
