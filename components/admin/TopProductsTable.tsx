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

export function TopProductsTable({ products, formatPrice }: TopProductsTableProps) {
  if (products.length === 0) {
    return <p className="text-gray-400 text-sm">No product sales yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-2 text-sm font-medium text-gray-500">Product</th>
            <th className="pb-2 text-sm font-medium text-gray-500 text-right">Qty Sold</th>
            <th className="pb-2 text-sm font-medium text-gray-500 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.productId} className="border-b border-gray-100 last:border-0">
              <td className="py-2 text-sm text-gray-900">{product.name}</td>
              <td className="py-2 text-sm text-gray-900 text-right">{product.totalQuantity}</td>
              <td className="py-2 text-sm text-gray-900 text-right">{formatPrice(product.totalRevenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
