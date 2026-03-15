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
import { FlowerAccent } from '@/components/ui/DecorativeElements';

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
      <div className="flex items-center gap-3 mb-6">
        <GradientHeading as="h2" size="xl">
          Shop
        </GradientHeading>
        <FlowerAccent className="w-6 h-6 opacity-60" />
      </div>

      {/* Search + Category filters */}
      <div className="mb-8 space-y-4">
        {/* Search bar */}
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#d4856b]"
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
            className="w-full pl-10 pr-4 py-2.5 border border-[#f0d5c0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#e8a87c]/40 focus:border-[#e8a87c] bg-white/80 text-[#4a3728] placeholder-[#b89a85] shadow-warm"
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
                  ? 'bg-gradient-to-r from-[#e8a87c] to-[#d4856b] text-white border-[#d4856b] shadow-warm'
                  : 'bg-white/80 text-[#7a6355] border-[#f0d5c0] hover:border-[#e8a87c] hover:text-[#d4856b]'
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((product, index) => (
            <div
              key={product.id}
              className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-warm overflow-hidden border-2 border-[#f0d5c0] group hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-1 hover:border-[#e8a87c] transition-all duration-300 relative animate-fade-in-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Link
                href={`/products/${product.id}`}
                className="block"
                aria-label={product.name}
              >
                {/* Product image with soft background */}
                <div className="relative w-full aspect-square bg-gradient-to-br from-[#fef0e6] to-[#fde8d8]/50 p-4">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-lg font-bold text-[#4a3728]">
                      {product.name}
                    </div>
                    <span className="text-sm mt-0.5">
                      <StockBadge stock={product.stock} />
                    </span>
                  </div>
                  <p className="text-[#7a6355] text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-[#d4856b]">
                      {formatPrice(product.price)}
                    </span>
                    <span className="inline-block bg-[#fde8d8] text-[#d4856b] rounded-full px-3 py-0.5 text-xs font-semibold border border-[#f0d5c0]">
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
