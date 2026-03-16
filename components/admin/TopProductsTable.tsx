'use client';

interface TopProduct {
  productId: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface TopProductsTableProps {
  readonly products: TopProduct[];
  readonly formatPrice: (price: number) => string;
}

interface TopProductRowProps {
  readonly product: TopProduct;
  readonly formatPrice: (price: number) => string;
}

function TopProductRow({ product, formatPrice }: TopProductRowProps) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <td className="py-2 text-sm text-gray-900 dark:text-white">{product.name}</td>
      <td className="py-2 text-sm text-gray-900 dark:text-white text-right">{product.totalQuantity}</td>
      <td className="py-2 text-sm text-gray-900 dark:text-white text-right">{formatPrice(product.totalRevenue)}</td>
    </tr>
  );
}

function TopProductsTableHeader() {
  return (
    <thead>
      <tr className="border-b border-gray-200 dark:border-gray-700">
        <th className="pb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Product</th>
        <th className="pb-2 text-sm font-medium text-gray-500 dark:text-gray-400 text-right">Qty Sold</th>
        <th className="pb-2 text-sm font-medium text-gray-500 dark:text-gray-400 text-right">Revenue</th>
      </tr>
    </thead>
  );
}

export function TopProductsTable({ products, formatPrice }: TopProductsTableProps) {
  if (products.length === 0) {
    return <p className="text-gray-400 dark:text-gray-500 text-sm">No product sales yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <TopProductsTableHeader />
        <tbody>
          {products.map((product) => (
            <TopProductRow key={product.productId} product={product} formatPrice={formatPrice} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
