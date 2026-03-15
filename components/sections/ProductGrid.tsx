'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { GradientHeading } from '@/components/ui/GradientHeading';
import { EmptyState } from '@/components/ui/EmptyState';

interface ProductGridProps {
  readonly products: Product[];
}

// Helper component for stock badge to avoid nested ternary
function StockBadge({ stock }: { readonly stock: number }) {
  if (stock > 5) {
    return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">In Stock</span>;
  }
  if (stock > 0) {
    return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold">Only {stock} left</span>;
  }
  return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">Out of Stock</span>;
}

export default function ProductGrid({ products }: ProductGridProps) {
  const { formatPrice } = useCurrency();

  return (
    <main id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <GradientHeading as="h2" className="mb-8">
        Featured Products
      </GradientHeading>

      {products.length === 0 ? (
        <EmptyState title="No items found" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100 group hover:shadow-2xl hover:scale-105 hover:-translate-y-1 hover:border-blue-200 transition-all duration-300"
            >
              <div className="relative h-64 w-full">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="p-4">
                {/* Using div instead of h2 to avoid nested interactive elements (Link > h2) which violates HTML semantics and accessibility guidelines */}
                <div className="text-xl font-semibold text-gray-900 mb-2">
                  {product.name}
                </div>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-2xl font-bold text-blue-600">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-sm">
                    <StockBadge stock={product.stock} />
                  </span>
                </div>
                <div className="mt-2">
                  <span className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full px-3 py-1 text-sm font-semibold">
                    {product.category}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
