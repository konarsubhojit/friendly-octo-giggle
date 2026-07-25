'use client'

import Link from 'next/link'

interface TopProduct {
  productId: string
  name: string
  totalQuantity: number
  totalRevenue: number
}

interface TopProductsTableProps {
  readonly products: readonly TopProduct[]
  readonly formatPrice: (price: number) => string
}

interface TopProductRowProps {
  readonly product: TopProduct
  readonly formatPrice: (price: number) => string
}

function TopProductRow({ product, formatPrice }: TopProductRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-slate-950">
        <Link
          href={`/admin/products/${product.productId}`}
          className="transition hover:text-emerald-700"
        >
          {product.name}
        </Link>
      </td>
      <td className="py-3 text-right text-sm text-slate-600">
        {product.totalQuantity}
      </td>
      <td className="py-3 text-right text-sm font-semibold text-slate-950">
        {formatPrice(product.totalRevenue)}
      </td>
    </tr>
  )
}

function TopProductsTableHeader() {
  return (
    <thead>
      <tr className="border-b border-slate-200">
        <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Product
        </th>
        <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Qty sold
        </th>
        <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Revenue
        </th>
      </tr>
    </thead>
  )
}

export function TopProductsTable({
  products,
  formatPrice,
}: TopProductsTableProps) {
  if (products.length === 0) {
    return <p className="text-sm text-slate-500">No product sales yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <TopProductsTableHeader />
        <tbody>
          {products.map((product) => (
            <TopProductRow
              key={product.productId}
              product={product}
              formatPrice={formatPrice}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
