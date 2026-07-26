import type { CheckoutPricingSummary } from '@/features/orders/services/order-summary'

interface CartPricingSummaryProps {
  readonly summary: CheckoutPricingSummary
  readonly formatPrice: (amount: number) => string
  readonly subtotalLabel?: string
  readonly shippingLabel?: string
  readonly taxLabel?: string
  readonly totalLabel?: string
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
  totalLabel = 'Total',
  className,
}: CartPricingSummaryProps) {
  const { itemCount } = summary

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
      <div className="border-t border-[var(--border-warm)] pt-3 flex justify-between">
        <span className="font-bold text-[var(--foreground)]">{totalLabel}</span>
        <span className="text-xl font-bold text-warm-heading">
          {formatPrice(summary.total)}
        </span>
      </div>
    </div>
  )
}
