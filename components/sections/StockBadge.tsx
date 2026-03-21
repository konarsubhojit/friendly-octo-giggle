export const StockBadge = ({ stock }: { readonly stock: number }) => {
  if (stock > 5) {
    return (
      <span className="bg-[#EEF2E9] text-[#366132] px-3 py-1 rounded-full font-semibold text-xs">
        In Stock
      </span>
    );
  }
  if (stock > 0) {
    return (
      <span className="bg-[#FCECE7] text-[#7A2020] px-3 py-1 rounded-full font-semibold text-xs">
        Only {stock} left
      </span>
    );
  }
  return (
    <span className="bg-red-500/10 text-red-700 px-3 py-1 rounded-full font-semibold text-xs">
      Out of Stock
    </span>
  );
};
