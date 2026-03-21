"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";
import { GradientHeading } from "@/components/ui/GradientHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { StockBadge } from "@/components/sections/StockBadge";
import { QuickAddButton } from "@/components/sections/QuickAddButton";
import { FlowerAccent } from "@/components/ui/DecorativeElements";
import { WishlistButton } from "@/components/ui/WishlistButton";

interface ProductGridProps {
  readonly products: Product[];
  readonly categories?: string[];
}

interface ProductCardProps {
  readonly product: Product;
  readonly formatPrice: (amount: number) => string;
  readonly index: number;
}

interface ProductImageAreaProps {
  readonly product: Product;
}

const ProductImageArea = ({ product }: ProductImageAreaProps) => {
  return (
    <div className="relative w-full aspect-square bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)] overflow-hidden">
      <Image
        src={product.image}
        alt={product.name}
        fill
        className="object-contain p-4 group-hover:scale-108 transition-transform duration-500"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
      <WishlistButton productId={product.id} productName={product.name} />
      <div className="absolute bottom-3 left-3">
        <StockBadge stock={product.stock} />
      </div>
    </div>
  );
};

const ProductCard = ({ product, formatPrice, index }: ProductCardProps) => {
  return (
    <div
      className="bg-[var(--surface)] rounded-3xl shadow-warm overflow-hidden border border-[var(--border-warm)] group hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-1 hover:border-[var(--accent-rose)] transition-all duration-300 relative animate-fade-in-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Link
        href={`/products/${product.id}`}
        className="block"
        aria-label={product.name}
      >
        <ProductImageArea product={product} />

        {/* Product info */}
        <div className="p-5">
          <h3 className="text-base font-bold text-[var(--foreground)] mb-1.5 line-clamp-1 group-hover:text-[var(--accent-rose)] transition-colors duration-200">
            {product.name}
          </h3>
          <p className="text-[var(--text-muted)] text-sm mb-4 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
          <div className="flex items-center">
            <span className="text-xl font-bold text-[var(--btn-primary)]">
              {formatPrice(product.price)}
            </span>
          </div>
        </div>
      </Link>
      <QuickAddButton product={product} />
    </div>
  );
};

const ProductGrid = ({ products, categories = [] }: ProductGridProps) => {
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categoryFilters = ["All", ...categories];

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    [],
  );

  const handleCategoryChange = useCallback(
    (category: string) => setSelectedCategory(category),
    [],
  );

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
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <GradientHeading as="h2" size="xl">
          All Products
        </GradientHeading>
        <FlowerAccent className="w-6 h-6 opacity-70" />
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8">
        Browse our complete handmade collection — crafted fresh for you.
      </p>

      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-rose)]"
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
            onChange={handleSearchChange}
            className="w-full pl-11 pr-4 py-3 border border-[var(--border-warm)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30 focus:border-[var(--accent-rose)] bg-[var(--surface)] text-[var(--foreground)] placeholder-[var(--text-muted)] shadow-warm transition-all duration-200"
            aria-label="Search products by name"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <svg
            className="w-4 h-4 text-[var(--accent-rose)] shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          <label
            htmlFor="category-filter"
            className="text-sm font-semibold text-[var(--text-secondary)] shrink-0"
          >
            Category
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="px-3 py-2.5 border border-[var(--border-warm)] rounded-full bg-[var(--surface)] text-[var(--foreground)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30 focus:border-[var(--accent-rose)] shadow-warm cursor-pointer transition-all duration-200"
            aria-label="Filter by category"
          >
            {categoryFilters.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
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
};

export default ProductGrid;
