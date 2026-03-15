'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { GradientHeading } from '@/components/ui/GradientHeading';
import { EmptyState } from '@/components/ui/EmptyState';
import { StockBadge } from '@/components/sections/StockBadge';
import { QuickAddButton } from '@/components/sections/QuickAddButton';

interface ProductGridProps {
  readonly products: Product[];
}

const CATEGORIES = ['All', 'Handbag', 'Flowers', 'Flower Pots', 'Keychains', 'Hair Accessories'];

export default function ProductGrid({ products }: ProductGridProps) {
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    const categoryLower = selectedCategory.toLowerCase();
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchLower);
      const matchesCategory =
        selectedCategory === 'All' ||
        p.category?.toLowerCase() === categoryLower;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const emptyMessage =
    search || selectedCategory !== 'All'
      ? 'Try adjusting your search or category filter.'
      : undefined;

  return (
    <main id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <GradientHeading as="h2" className="mb-4">
        ⭐ Bestsellers
      </GradientHeading>

      {/* Search + Category filters */}
      <div className="mb-8 space-y-4">
        {/* Search bar */}
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 bg-white text-gray-900 placeholder-gray-400 shadow-sm"
            aria-label="Search products by name"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                selectedCategory === cat
                  ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300 hover:text-rose-500'
              }`}
              aria-pressed={selectedCategory === cat}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No products found" message={emptyMessage} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100 group hover:shadow-2xl hover:scale-105 hover:-translate-y-1 hover:border-rose-200 transition-all duration-300 relative"
            >
              <Link
                href={`/products/${product.id}`}
                className="block"
                aria-label={product.name}
              >
                {/* Product image — aspect-[4/3] shows full image without clipping */}
                <div className="relative w-full aspect-[4/3] bg-gray-50">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain p-2"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-4">
                  <div className="text-xl font-semibold text-gray-900 mb-2">
                    {product.name}
                  </div>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-2xl font-bold text-rose-500">
                      {formatPrice(product.price)}
                    </span>
                    <span className="text-sm">
                      <StockBadge stock={product.stock} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-full px-3 py-1 text-sm font-semibold">
                      {product.category}
                    </span>
                  </div>
                </div>
              </Link>
              {/* Quick add button sits OUTSIDE the <Link> to avoid invalid HTML nesting */}
              <QuickAddButton product={product} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
