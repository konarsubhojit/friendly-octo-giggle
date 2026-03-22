"use client";

import { memo, startTransition, useEffect, useRef, useState } from "react";
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

export type ProductGridItem = Pick<
  Product,
  "id" | "name" | "description" | "price" | "image" | "stock" | "category"
>;

interface ProductGridProps {
  readonly products: ProductGridItem[];
  readonly categories?: string[];
  readonly search?: string;
  readonly selectedCategory?: string;
  readonly hasNextPage?: boolean;
  readonly batchSize?: number;
}

interface ProductCardProps {
  readonly product: ProductGridItem;
  readonly formatPrice: (amount: number) => string;
  readonly index: number;
}

interface ProductImageAreaProps {
  readonly product: ProductGridItem;
  readonly eagerLoad: boolean;
}

const DEFAULT_CATEGORY = "All";
const DEFAULT_BATCH_SIZE = 15;

function createProductsApiHref(
  offset: number,
  limit: number,
  search: string,
  selectedCategory: string,
) {
  const params = new URLSearchParams();

  if (search) {
    params.set("q", search);
  }

  if (selectedCategory !== DEFAULT_CATEGORY) {
    params.set("category", selectedCategory);
  }

  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const queryString = params.toString();
  return queryString ? `/api/products?${queryString}` : "/api/products";
}

function mergeProducts(
  existingProducts: ProductGridItem[],
  nextProducts: ProductGridItem[],
) {
  const productsById = new Map(
    existingProducts.map((product) => [product.id, product]),
  );

  for (const product of nextProducts) {
    if (!productsById.has(product.id)) {
      productsById.set(product.id, product);
    }
  }

  return Array.from(productsById.values());
}

const ProductImageArea = memo(
  ({ product, eagerLoad }: ProductImageAreaProps) => {
    return (
      <div className="relative w-full aspect-square bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-4 group-hover:scale-108 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          loading={eagerLoad ? "eager" : undefined}
          fetchPriority={eagerLoad ? "high" : undefined}
        />
        <WishlistButton productId={product.id} productName={product.name} />
        <div className="absolute bottom-3 left-3">
          <StockBadge stock={product.stock} />
        </div>
      </div>
    );
  },
);

ProductImageArea.displayName = "ProductImageArea";

const ProductCard = memo(
  ({ product, formatPrice, index }: ProductCardProps) => {
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
          <ProductImageArea product={product} eagerLoad={index < 3} />

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
  },
);

ProductCard.displayName = "ProductCard";

const ProductGrid = ({
  products,
  categories = [],
  search = "",
  selectedCategory = DEFAULT_CATEGORY,
  hasNextPage = false,
  batchSize = DEFAULT_BATCH_SIZE,
}: ProductGridProps) => {
  const { formatPrice } = useCurrency();
  const [visibleProducts, setVisibleProducts] = useState(products);
  const [canLoadMore, setCanLoadMore] = useState(hasNextPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const categoryFilters = [DEFAULT_CATEGORY, ...categories];

  const emptyMessage =
    search || selectedCategory !== DEFAULT_CATEGORY
      ? "Try adjusting your search or category filter."
      : undefined;

  useEffect(() => {
    setVisibleProducts(products);
    setCanLoadMore(hasNextPage);
    setIsLoadingMore(false);
    setLoadError(null);
    setHasUserScrolled(false);
  }, [products, hasNextPage, search, selectedCategory]);

  useEffect(() => {
    const handleScroll = () => {
      if (globalThis.scrollY > 0) {
        setHasUserScrolled(true);
      }
    };

    globalThis.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      globalThis.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const loadMoreProducts = async () => {
    if (isLoadingMore || !canLoadMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const response = await fetch(
        createProductsApiHref(
          visibleProducts.length,
          batchSize,
          search,
          selectedCategory,
        ),
        { method: "GET", headers: { Accept: "application/json" } },
      );

      const payload = (await response.json()) as {
        readonly success?: boolean;
        readonly error?: string;
        readonly data?: {
          readonly products?: ProductGridItem[];
          readonly hasMore?: boolean;
        };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load more products.");
      }

      const nextProducts = payload.data?.products ?? [];
      const nextHasMore = Boolean(payload.data?.hasMore);

      startTransition(() => {
        setVisibleProducts((currentProducts) =>
          mergeProducts(currentProducts, nextProducts),
        );
        setCanLoadMore(nextHasMore);
      });
    } catch {
      setLoadError("Could not load more products. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!canLoadMore || !sentinelRef.current || !hasUserScrolled) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreProducts();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [
    batchSize,
    canLoadMore,
    hasUserScrolled,
    isLoadingMore,
    search,
    selectedCategory,
    visibleProducts.length,
  ]);

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
        Browse our complete handmade collection — {visibleProducts.length}
        {canLoadMore ? "+" : ""} items loaded for you.
      </p>

      <form
        action="/shop#products"
        method="get"
        className="mb-8 flex flex-col sm:flex-row gap-3 items-start"
      >
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
            name="q"
            placeholder="Search products..."
            defaultValue={search}
            className="w-full pl-11 pr-4 py-3 border border-[var(--border-warm)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30 focus:border-[var(--accent-rose)] bg-[var(--surface)] text-[var(--foreground)] placeholder-[var(--text-muted)] shadow-warm transition-all duration-200"
            aria-label="Search products"
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
            name="category"
            defaultValue={selectedCategory}
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="submit"
            className="px-4 py-2.5 rounded-full bg-[var(--btn-primary)] text-white text-sm font-semibold shadow-warm hover:shadow-warm-lg transition-all duration-200"
          >
            Apply
          </button>
          {(search || selectedCategory !== DEFAULT_CATEGORY) && (
            <Link
              href="/shop#products"
              className="px-4 py-2.5 rounded-full border border-[var(--border-warm)] bg-[var(--surface)] text-[var(--foreground)] text-sm font-semibold shadow-warm hover:border-[var(--accent-rose)] transition-colors duration-200"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {visibleProducts.length === 0 ? (
        <EmptyState title="No products found" message={emptyMessage} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                formatPrice={formatPrice}
                index={index}
              />
            ))}
          </div>

          <div className="mt-8 border-t border-[var(--border-warm)] pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-[var(--text-muted)]">
                Showing {visibleProducts.length} product
                {visibleProducts.length === 1 ? "" : "s"}
                {canLoadMore ? " so far" : ""}.
              </p>
              {canLoadMore ? (
                <button
                  type="button"
                  onClick={() => void loadMoreProducts()}
                  disabled={isLoadingMore}
                  className="px-5 py-3 rounded-full bg-[var(--btn-primary)] text-white text-sm font-semibold shadow-warm hover:shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoadingMore ? "Loading more..." : `Load ${batchSize} more`}
                </button>
              ) : (
                <span className="text-sm font-medium text-[var(--text-muted)]">
                  You have reached the end of this result set.
                </span>
              )}
            </div>

            {loadError ? (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                {loadError}
              </p>
            ) : null}

            <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />
          </div>
        </>
      )}
    </main>
  );
};

export default ProductGrid;
