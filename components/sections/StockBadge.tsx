export function StockBadge({ stock }: { readonly stock: number }) {
  if (stock > 5) {
    return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">In Stock</span>;
  }
  if (stock > 0) {
    return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold">Only {stock} left</span>;
  }
  return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">Out of Stock</span>;
}
