'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';

interface TrendingProduct extends Product {
  totalSold: number;
}

export default function TrendingProducts() {
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch('/api/products/trending?limit=6');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.data?.products || data.products || []);
        }
      } catch {
        // Silently fail - trending is non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, []);

  if (loading) {
    return (
      <section id="trending" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">
          🔥 Trending Now
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section id="trending" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">
        🔥 Trending Now
      </h2>
      <p className="text-gray-500 mb-8">Most popular items loved by our customers</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product, index) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100 group hover:shadow-2xl hover:scale-105 hover:-translate-y-1 hover:border-rose-200 transition-all duration-300 relative"
          >
            {index < 3 && (
              <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                #{index + 1} Trending
              </div>
            )}
            <div className="relative h-48 w-full">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <div className="p-4">
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {product.name}
              </div>
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {product.description}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-rose-500">
                  {formatPrice(product.price)}
                </span>
                <span className="inline-block bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-full px-3 py-1 text-xs font-semibold">
                  {product.category}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
