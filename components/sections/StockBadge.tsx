export function StockBadge({ stock }: { readonly stock: number }) {
  if (stock > 5) {
    return (
      <span className="bg-[var(--accent-sage)]/20 text-[var(--accent-sage)] px-3 py-1 rounded-full font-semibold text-xs">
        In Stock
      </span>
    );
  }
  if (stock > 0) {
    return (
      <span className="bg-[var(--accent-peach)]/30 text-[var(--accent-rose)] px-3 py-1 rounded-full font-semibold text-xs">
        Only {stock} left
      </span>
    );
  }
  return (
    <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full font-semibold text-xs">
      Out of Stock
    </span>
  );
}
