"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
const DEFAULT_BATCH_SIZE = 20;

const createProductsApiHref = (
  offset: number,
  limit: number,
  search: string,
  selectedCategory: string,
) => {
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
};

const mergeProducts = (
  existingProducts: ProductGridItem[],
  nextProducts: ProductGridItem[],
) => {
  const productsById = new Map(
    existingProducts.map((product) => [product.id, product]),
  );

  for (const product of nextProducts) {
    if (!productsById.has(product.id)) {
      productsById.set(product.id, product);
    }
  }

  return Array.from(productsById.values());
};

const ProductImageArea = memo(
  ({ product, eagerLoad }: ProductImageAreaProps) => {
    return (
      <div className="bg-theme-image relative aspect-square w-full overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-4 transition-transform duration-500 group-hover:scale-108"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
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
        className="bg-theme-card group relative overflow-hidden rounded-3xl border border-[var(--border-warm)] shadow-warm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-[var(--accent-rose)] hover:shadow-warm-lg"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-80"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--accent-peach) 38%, transparent) 0%, transparent 100%)",
          }}
          aria-hidden="true"
        />
        <Link
          href={`/products/${product.id}`}
          className="block"
          aria-label={product.name}
        >
          <ProductImageArea product={product} eagerLoad={index < 3} />

          <div className="p-5">
            <h3 className="mb-1.5 line-clamp-1 text-base font-bold text-[var(--foreground)] transition-colors duration-200 group-hover:text-[var(--accent-rose)]">
              {product.name}
            </h3>
            <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">
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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);
  const canLoadMoreRef = useRef(hasNextPage);
  const visibleCountRef = useRef(products.length);
  const searchRef = useRef(search);
  const categoryRef = useRef(selectedCategory);
  const batchSizeRef = useRef(batchSize);

  const categoryFilters = [DEFAULT_CATEGORY, ...categories];

  const emptyMessage =
    search || selectedCategory !== DEFAULT_CATEGORY
      ? "Try adjusting your search or category filter."
      : undefined;

  useEffect(() => {
    setVisibleProducts(products);
    setCanLoadMore(hasNextPage);
    canLoadMoreRef.current = hasNextPage;
    visibleCountRef.current = products.length;
    setIsLoadingMore(false);
    isLoadingRef.current = false;
    setLoadError(null);
  }, [products, hasNextPage, search, selectedCategory]);

  useEffect(() => {
    searchRef.current = search;
    categoryRef.current = selectedCategory;
    batchSizeRef.current = batchSize;
  }, [search, selectedCategory, batchSize]);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !canLoadMoreRef.current) return;

    isLoadingRef.current = true;
    setIsLoadingMore(true);
    setLoadError(null);

    const currentOffset = visibleCountRef.current;

    try {
      const response = await fetch(
        createProductsApiHref(
          currentOffset,
          batchSizeRef.current,
          searchRef.current,
          categoryRef.current,
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
        setVisibleProducts((currentProducts) => {
          const merged = mergeProducts(currentProducts, nextProducts);
          visibleCountRef.current = merged.length;
          return merged;
        });
        setCanLoadMore(nextHasMore);
        canLoadMoreRef.current = nextHasMore;
      });
    } catch {
      setLoadError("Could not load more products. Please try again.");
    } finally {
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          canLoadMoreRef.current &&
          !isLoadingRef.current
        ) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <main
      id="products"
      className="mx-auto w-full max-w-[96rem] px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
    >
      <div className="mb-2 flex items-center gap-3">
        <GradientHeading as="h2" size="xl">
          All Products
        </GradientHeading>
        <FlowerAccent className="h-6 w-6 opacity-70" />
      </div>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        Browse our complete handmade collection — {visibleProducts.length}
        {canLoadMore ? "+" : ""} items loaded for you.
      </p>

      <form
        action="/shop#products"
        method="get"
        className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="relative w-full lg:max-w-xl lg:flex-1">
          <svg
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--accent-rose)]"
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
            className="glass-card w-full rounded-full border border-[var(--border-warm)] py-3 pl-11 pr-4 text-[var(--foreground)] shadow-warm transition-all duration-200 placeholder-[var(--text-muted)] focus:border-[var(--accent-rose)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30"
            aria-label="Search products"
          />
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
          <div className="glass-card flex w-full min-w-0 items-center gap-2 rounded-[1.75rem] border border-[var(--border-warm)] px-4 py-2.5 shadow-warm sm:w-auto">
            <svg
              className="h-4 w-4 shrink-0 text-[var(--accent-rose)]"
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
              className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]"
            >
              Category
            </label>
            <select
              id="category-filter"
              name="category"
              defaultValue={selectedCategory}
              className="min-w-0 flex-1 bg-transparent pr-6 text-sm font-medium text-[var(--foreground)] focus:outline-none"
              aria-label="Filter by category"
            >
              {categoryFilters.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="submit"
              className="flex-1 rounded-full bg-[var(--btn-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-warm transition-all duration-200 hover:shadow-warm-lg sm:flex-none"
            >
              Apply
            </button>
            {(search || selectedCategory !== DEFAULT_CATEGORY) && (
              <Link
                href="/shop#products"
                className="flex-1 rounded-full border border-[var(--border-warm)] bg-[var(--surface)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--foreground)] shadow-warm transition-colors duration-200 hover:border-[var(--accent-rose)] sm:flex-none"
              >
                Reset
              </Link>
            )}
          </div>
        </div>
      </form>

      {visibleProducts.length === 0 ? (
        <EmptyState title="No products found" message={emptyMessage} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Showing {visibleProducts.length} product
              {visibleProducts.length === 1 ? "" : "s"}
              {canLoadMore ? " so far" : "."}
            </p>

            {loadError ? (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                {loadError}
              </p>
            ) : null}
          </div>

          <div ref={sentinelRef} className="h-4" aria-hidden="true" />

          {isLoadingMore && (
            <div className="mt-4 flex justify-center py-4" aria-live="polite">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--accent-rose)] border-t-transparent" />
            </div>
          )}

          {!canLoadMore && visibleProducts.length > 0 && (
            <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
              You&apos;ve seen all products.
            </p>
          )}
        </>
      )}
    </main>
  );
};

export default ProductGrid;
