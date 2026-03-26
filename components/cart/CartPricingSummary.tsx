interface CartPricingSummaryProps {
  readonly itemCount: number;
  readonly subtotalLabel?: string;
  readonly shippingLabel?: string;
  readonly totalLabel?: string;
  readonly subtotal: string;
  readonly shipping: string;
  readonly total: string;
  readonly className?: string;
}

export function CartPricingSummary({
  itemCount,
  subtotalLabel = "Subtotal",
  shippingLabel = "Shipping",
  totalLabel = "Total",
  subtotal,
  shipping,
  total,
  className,
}: CartPricingSummaryProps) {
  return (
    <div className={className ?? "space-y-3 text-sm"}>
      <div className="flex justify-between text-[var(--text-secondary)]">
        <span>
          {subtotalLabel} ({itemCount} {itemCount === 1 ? "item" : "items"})
        </span>
        <span className="font-medium">{subtotal}</span>
      </div>
      <div className="flex justify-between text-[var(--text-secondary)]">
        <span>{shippingLabel}</span>
        <span className="text-[var(--accent-sage)] font-medium">
          {shipping}
        </span>
      </div>
      <div className="border-t border-[var(--border-warm)] pt-3 flex justify-between">
        <span className="font-bold text-[var(--foreground)]">{totalLabel}</span>
        <span className="text-xl font-bold text-warm-heading">{total}</span>
      </div>
    </div>
  );
}
