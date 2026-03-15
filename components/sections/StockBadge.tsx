export function StockBadge({ stock }: { readonly stock: number }) {
  if (stock > 5) {
    return <span className="bg-[#d4e4c4] text-[#5a7a42] px-3 py-1 rounded-full font-semibold text-xs">In Stock</span>;
  }
  if (stock > 0) {
    return <span className="bg-[#fde8d8] text-[#c97b5e] px-3 py-1 rounded-full font-semibold text-xs">Only {stock} left</span>;
  }
  return <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full font-semibold text-xs">Out of Stock</span>;
}
