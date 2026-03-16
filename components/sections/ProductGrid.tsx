"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";
import { GradientHeading } from "@/components/ui/GradientHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { StockBadge } from "@/components/sections/StockBadge";
import { QuickAddButton } from "@/components/sections/QuickAddButton";
import { FlowerAccent } from "@/components/ui/DecorativeElements";
import { CATEGORY_FILTERS } from "@/lib/constants/categories";

interface ProductGridProps {
  readonly products: Product[];
}

interface ProductCardProps {
  readonly product: Product;
  readonly formatPrice: (amount: number) => string;
  readonly index: number;
}

function ProductCard({ product, formatPrice, index }: ProductCardProps) {
  return (
    <div
      className="bg-[var(--surface)] backdrop-blur-sm rounded-3xl shadow-warm overflow-hidden border-2 border-[var(--border-warm)] group hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-1 hover:border-[var(--accent-warm)] transition-all duration-300 relative animate-fade-in-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Link
        href={`/products/${product.id}`}
        className="block"
        aria-label={product.name}
      >
        <div className="relative w-full aspect-square bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)]/50 p-4">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {/* Heart/wishlist icon (visual only) */}
          <button
            type="button"
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[var(--surface)]/80 backdrop-blur-sm border border-[var(--border-warm)] flex items-center justify-center text-[var(--accent-pink)] hover:bg-[var(--accent-blush)] hover:scale-110 transition-all duration-200 shadow-warm focus-warm"
            aria-label={`Add ${product.name} to wishlist`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="text-lg font-bold text-[var(--foreground)]">
              {product.name}
            </div>
            <span className="text-sm mt-0.5">
              <StockBadge stock={product.stock} />
            </span>
          </div>
          <p className="text-[var(--text-secondary)] text-sm mb-3 line-clamp-2">
            {product.description}
          </p>
          <div className="flex items-center">
            <span className="text-xl font-bold text-[var(--accent-rose)]">
              {formatPrice(product.price)}
            </span>
          </div>
        </div>
      </Link>
      <QuickAddButton product={product} />
    </div>
  );
}

export default function ProductGrid({ products }: ProductGridProps) {
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    const categoryLower = selectedCategory.toLowerCase();
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchLower);
      const matchesCategory =
        selectedCategory === "All" ||
        p.category?.toLowerCase() === categoryLower;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const emptyMessage =
    search || selectedCategory !== "All"
      ? "Try adjusting your search or category filter."
      : undefined;

  return (
    <main
      id="products"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
    >
      <div className="flex items-center gap-3 mb-6">
        <GradientHeading as="h2" size="xl">
          Bestsellers
        </GradientHeading>
        <FlowerAccent className="w-6 h-6 opacity-60" />
      </div>

      {/* Search + Category filters */}
      <div className="mb-8 space-y-4">
        {/* Search bar */}
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--accent-rose)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[var(--border-warm)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] bg-[var(--surface)]/80 text-[var(--foreground)] placeholder-[var(--text-muted)] shadow-warm"
            aria-label="Search products by name"
          />
        </div>

        {/* Category pills */}
        <fieldset
          className="flex flex-wrap gap-2"
          aria-label="Filter by category"
        >
          <legend className="sr-only">Filter by category</legend>
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                selectedCategory === cat
                  ? "bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white border-[var(--accent-rose)] shadow-warm"
                  : "bg-[var(--surface)]/80 text-[var(--text-secondary)] border-[var(--border-warm)] hover:border-[var(--accent-warm)] hover:text-[var(--accent-rose)]"
              }`}
              aria-pressed={selectedCategory === cat}
            >
              {cat}
            </button>
          ))}
        </fieldset>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No products found" message={emptyMessage} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              formatPrice={formatPrice}
              index={index}
            />
          ))}
        </div>
      )}
    </main>
  );
}
