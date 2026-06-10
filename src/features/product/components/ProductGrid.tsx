'use client'

import {
  Fragment,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from '@/components/ui/LocaleLink'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Product } from '@/lib/types'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useLocale } from '@/contexts/LocaleContext'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { EmptyState } from '@/components/ui/EmptyState'
import { StockBadge } from '@/features/product/components/StockBadge'
import { FlowerAccent } from '@/components/ui/DecorativeElements'
import { WishlistButton } from '@/features/wishlist/components/WishlistButton'
import { SearchBar } from '@/components/SearchBar'
import { PRODUCT_CARD_BLUR_DATA_URL } from '@/lib/image-placeholder'

export type ProductGridItem = Pick<
  Product,
  'id' | 'name' | 'description' | 'image' | 'category'
> & {
  /** Derived min price from variants; 0 if no variants */
  price: number
  /** Derived total stock from variants; 0 if no variants */
  stock: number
  /** Aggregated sold quantity from confirmed orders */
  soldCount: number
}

type VariantOption = 'all' | 'single' | 'multiple'

interface ProductGridProps {
  readonly products: ProductGridItem[]
  readonly categories?: string[]
  readonly search?: string
  readonly selectedCategory?: string
  readonly selectedSort?: string
  readonly minPrice?: number
  readonly maxPrice?: number
  readonly inStock?: boolean
  readonly minRating?: number
  readonly variant?: VariantOption
  readonly suggestions?: string[]
  readonly trending?: Array<{ id: string; name: string; category: string }>
  readonly hasNextPage?: boolean
  readonly batchSize?: number
}

interface ProductCardProps {
  readonly product: ProductGridItem
  readonly formatPrice: (amount: number) => string
  readonly index: number
  readonly query: string
}

interface ProductImageAreaProps {
  readonly product: ProductGridItem
  readonly eagerLoad: boolean
}

const DEFAULT_CATEGORY = 'All'
const DEFAULT_BATCH_SIZE = 20
const DEFAULT_SORT = 'relevance'

const toFiniteNumber = (raw: string): number | undefined => {
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

const orderedPriceRange = (
  minPrice: number | undefined,
  maxPrice: number | undefined
): {
  safeMinPrice: number | undefined
  safeMaxPrice: number | undefined
} => {
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return { safeMinPrice: maxPrice, safeMaxPrice: minPrice }
  }
  return { safeMinPrice: minPrice, safeMaxPrice: maxPrice }
}

type SearchDraftInput = {
  searchDraft: string
  categoryDraft: string
  sortDraft: string
  minPriceDraft: string
  maxPriceDraft: string
  inStockDraft: boolean
  minRatingDraft: string
  variantDraft: VariantOption
}

const buildSearchParams = (input: SearchDraftInput): URLSearchParams => {
  const params = new URLSearchParams()
  const normalizedSearch = input.searchDraft.trim()
  const normalizedCategory = input.categoryDraft.trim()
  const minRating = toFiniteNumber(input.minRatingDraft)
  const { safeMinPrice, safeMaxPrice } = orderedPriceRange(
    toFiniteNumber(input.minPriceDraft),
    toFiniteNumber(input.maxPriceDraft)
  )

  if (normalizedSearch) params.set('q', normalizedSearch)
  if (normalizedCategory && normalizedCategory !== DEFAULT_CATEGORY) {
    params.set('category', normalizedCategory)
  }
  if (input.sortDraft !== DEFAULT_SORT) params.set('sort', input.sortDraft)
  if (typeof safeMinPrice === 'number' && safeMinPrice >= 0) {
    params.set('minPrice', String(safeMinPrice))
  }
  if (typeof safeMaxPrice === 'number' && safeMaxPrice >= 0) {
    params.set('maxPrice', String(safeMaxPrice))
  }
  if (input.inStockDraft) params.set('inStock', 'true')
  if (minRating !== undefined && minRating >= 0) {
    params.set('minRating', String(minRating))
  }
  if (input.variantDraft !== 'all') params.set('variant', input.variantDraft)
  return params
}

type ProductsApiHrefOptions = {
  offset: number
  limit: number
  search: string
  selectedCategory: string
  selectedSort: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  minRating?: number
  variant?: VariantOption
}

const createProductsApiHref = ({
  offset,
  limit,
  search,
  selectedCategory,
  selectedSort,
  minPrice,
  maxPrice,
  inStock,
  minRating,
  variant = 'all',
}: ProductsApiHrefOptions) => {
  const params = new URLSearchParams()

  if (search) {
    params.set('q', search)
  }

  if (selectedCategory !== DEFAULT_CATEGORY) {
    params.set('category', selectedCategory)
  }

  if (selectedSort !== DEFAULT_SORT) {
    params.set('sort', selectedSort)
  }

  if (typeof minPrice === 'number') {
    params.set('minPrice', String(minPrice))
  }

  if (typeof maxPrice === 'number') {
    params.set('maxPrice', String(maxPrice))
  }

  if (inStock) {
    params.set('inStock', 'true')
  }

  if (typeof minRating === 'number') {
    params.set('minRating', String(minRating))
  }

  if (variant !== 'all') {
    params.set('variant', variant)
  }

  params.set('limit', String(limit))
  params.set('offset', String(offset))

  const queryString = params.toString()
  return queryString ? `/api/products?${queryString}` : '/api/products'
}

const mergeProducts = (
  existingProducts: ProductGridItem[],
  nextProducts: ProductGridItem[]
) => {
  const productsById = new Map(
    existingProducts.map((product) => [product.id, product])
  )

  for (const product of nextProducts) {
    if (!productsById.has(product.id)) {
      productsById.set(product.id, product)
    }
  }

  return Array.from(productsById.values())
}

const highlightMatches = (text: string, query: string) => {
  const normalized = query.trim()
  if (!normalized) {
    return text
  }

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  const regex = new RegExp(`(${escaped})`, 'ig')
  const segments = text.split(regex)

  return segments.map((segment, index) =>
    index % 2 === 1 ? (
      <mark
        key={`m-${index}-${segment}`}
        className="rounded bg-[var(--accent-blush)] px-0.5"
      >
        {segment}
      </mark>
    ) : (
      <Fragment key={`s-${index}-${segment}`}>{segment}</Fragment>
    )
  )
}

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
          priority={eagerLoad}
          loading={eagerLoad ? undefined : 'lazy'}
          decoding="async"
          placeholder="blur"
          blurDataURL={PRODUCT_CARD_BLUR_DATA_URL}
        />
        <WishlistButton productId={product.id} productName={product.name} />
        <div className="absolute bottom-3 left-3">
          <StockBadge stock={product.stock} />
        </div>
      </div>
    )
  }
)

ProductImageArea.displayName = 'ProductImageArea'

const ProductCard = memo(
  ({ product, formatPrice, index, query }: ProductCardProps) => {
    const trackClick = useCallback(() => {
      const body = JSON.stringify({
        productId: product.id,
        query: query || undefined,
      })
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const payload = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon('/api/search/click', payload)
        return
      }

      void fetch('/api/search/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
    }, [product.id, query])

    return (
      <div
        className="bg-theme-card group relative overflow-hidden rounded-3xl border border-[var(--border-warm)] shadow-warm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-[var(--accent-rose)] hover:shadow-warm-lg"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-theme-card-overlay opacity-80"
          aria-hidden="true"
        />
        <Link
          href={`/products/${product.id}`}
          onClick={trackClick}
          className="block"
          aria-label={product.name}
        >
          <ProductImageArea product={product} eagerLoad={index < 3} />

          <div className="p-5">
            <h3 className="mb-1.5 line-clamp-1 text-base font-bold text-[var(--foreground)] transition-colors duration-200 group-hover:text-[var(--accent-rose)]">
              {highlightMatches(product.name, query)}
            </h3>
            <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">
              {highlightMatches(product.description, query)}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-[var(--btn-primary)]">
                {formatPrice(product.price)}
              </span>
              <output
                className="text-sm font-semibold text-[var(--text-muted)]"
                aria-label={`Total units sold: ${product.soldCount}`}
              >
                {product.soldCount} Sold
              </output>
            </div>
          </div>
        </Link>
      </div>
    )
  }
)

ProductCard.displayName = 'ProductCard'

const ProductGrid = ({
  products,
  categories = [],
  search = '',
  selectedCategory = DEFAULT_CATEGORY,
  selectedSort = DEFAULT_SORT,
  minPrice,
  maxPrice,
  inStock = false,
  minRating,
  variant = 'all',
  suggestions = [],
  trending = [],
  hasNextPage = false,
  batchSize = DEFAULT_BATCH_SIZE,
}: ProductGridProps) => {
  const router = useRouter()
  const { formatPrice } = useCurrency()
  const { localizePath } = useLocale()
  const [visibleProducts, setVisibleProducts] = useState(products)
  const [canLoadMore, setCanLoadMore] = useState(hasNextPage)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState(search)
  const [categoryDraft, setCategoryDraft] = useState(selectedCategory)
  const [sortDraft, setSortDraft] = useState(selectedSort)
  const [minPriceDraft, setMinPriceDraft] = useState<string>(
    typeof minPrice === 'number' ? String(minPrice) : ''
  )
  const [maxPriceDraft, setMaxPriceDraft] = useState<string>(
    typeof maxPrice === 'number' ? String(maxPrice) : ''
  )
  const [inStockDraft, setInStockDraft] = useState(inStock)
  const [minRatingDraft, setMinRatingDraft] = useState<string>(
    typeof minRating === 'number' ? String(minRating) : ''
  )
  const [variantDraft, setVariantDraft] = useState<VariantOption>(variant)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const isLoadingRef = useRef(false)
  const canLoadMoreRef = useRef(hasNextPage)
  const visibleCountRef = useRef(products.length)
  const searchRef = useRef(search)
  const categoryRef = useRef(selectedCategory)
  const sortRef = useRef(selectedSort)
  const minPriceRef = useRef(minPrice)
  const maxPriceRef = useRef(maxPrice)
  const inStockRef = useRef(inStock)
  const minRatingRef = useRef(minRating)
  const variantRef = useRef(variant)
  const batchSizeRef = useRef(batchSize)

  const categoryFilters = [DEFAULT_CATEGORY, ...categories]
  const hasActiveFilters =
    Boolean(search) ||
    selectedCategory !== DEFAULT_CATEGORY ||
    selectedSort !== DEFAULT_SORT ||
    typeof minPrice === 'number' ||
    typeof maxPrice === 'number' ||
    inStock ||
    typeof minRating === 'number' ||
    variant !== 'all'

  const emptyMessage = hasActiveFilters
    ? 'Try adjusting your search or category filter.'
    : undefined

  useEffect(() => {
    // Update refs synchronously so loadMore() (called by the
    // IntersectionObserver) always sees the latest pagination state even
    // before the deferred state updates flush.
    canLoadMoreRef.current = hasNextPage
    visibleCountRef.current = products.length
    isLoadingRef.current = false

    const timer = globalThis.setTimeout(() => {
      setVisibleProducts(products)
      setCanLoadMore(hasNextPage)
      setIsLoadingMore(false)
      setLoadError(null)
    }, 0)

    return () => {
      globalThis.clearTimeout(timer)
    }
  }, [products, hasNextPage, search, selectedCategory])

  useEffect(() => {
    searchRef.current = search
    categoryRef.current = selectedCategory
    sortRef.current = selectedSort
    minPriceRef.current = minPrice
    maxPriceRef.current = maxPrice
    inStockRef.current = inStock
    minRatingRef.current = minRating
    variantRef.current = variant
    batchSizeRef.current = batchSize
  }, [
    search,
    selectedCategory,
    selectedSort,
    minPrice,
    maxPrice,
    inStock,
    minRating,
    variant,
    batchSize,
  ])

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setSearchDraft(search)
      setCategoryDraft(selectedCategory)
      setSortDraft(selectedSort)
      setMinPriceDraft(typeof minPrice === 'number' ? String(minPrice) : '')
      setMaxPriceDraft(typeof maxPrice === 'number' ? String(maxPrice) : '')
      setInStockDraft(inStock)
      setMinRatingDraft(typeof minRating === 'number' ? String(minRating) : '')
      setVariantDraft(variant)
    }, 0)

    return () => {
      globalThis.clearTimeout(timer)
    }
  }, [
    search,
    selectedCategory,
    selectedSort,
    minPrice,
    maxPrice,
    inStock,
    minRating,
    variant,
  ])

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !canLoadMoreRef.current) return

    isLoadingRef.current = true
    setIsLoadingMore(true)
    setLoadError(null)

    const currentOffset = visibleCountRef.current

    try {
      const response = await fetch(
        createProductsApiHref({
          offset: currentOffset,
          limit: batchSizeRef.current,
          search: searchRef.current,
          selectedCategory: categoryRef.current,
          selectedSort: sortRef.current,
          minPrice: minPriceRef.current,
          maxPrice: maxPriceRef.current,
          inStock: inStockRef.current,
          minRating: minRatingRef.current,
          variant: variantRef.current,
        }),
        { method: 'GET', headers: { Accept: 'application/json' } }
      )

      const payload = (await response.json()) as {
        readonly success?: boolean
        readonly error?: string
        readonly data?: {
          readonly products?: ProductGridItem[]
          readonly hasMore?: boolean
        }
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Unable to load more products.')
      }

      const nextProducts = payload.data?.products ?? []
      const nextHasMore = Boolean(payload.data?.hasMore)

      startTransition(() => {
        setVisibleProducts((currentProducts) => {
          const merged = mergeProducts(currentProducts, nextProducts)
          visibleCountRef.current = merged.length
          return merged
        })
        setCanLoadMore(nextHasMore)
        canLoadMoreRef.current = nextHasMore
      })
    } catch {
      setLoadError('Could not load more products. Please try again.')
    } finally {
      setIsLoadingMore(false)
      isLoadingRef.current = false
    }
  }, [])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (
          entry?.isIntersecting &&
          canLoadMoreRef.current &&
          !isLoadingRef.current
        ) {
          void loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const resetHref = useMemo(() => '/shop#products', [])

  const applySearchState = useCallback(() => {
    const params = buildSearchParams({
      searchDraft,
      categoryDraft,
      sortDraft,
      minPriceDraft,
      maxPriceDraft,
      inStockDraft,
      minRatingDraft,
      variantDraft,
    })

    const query = params.toString()
    router.push(localizePath(query ? `/shop?${query}#products` : resetHref), {
      scroll: false,
    })
  }, [
    searchDraft,
    categoryDraft,
    sortDraft,
    minPriceDraft,
    maxPriceDraft,
    inStockDraft,
    minRatingDraft,
    variantDraft,
    router,
    resetHref,
    localizePath,
  ])

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
        {canLoadMore ? '+' : ''} items loaded for you.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          applySearchState()
        }}
        className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="relative w-full lg:max-w-xl lg:flex-1">
          <SearchBar
            value={searchDraft}
            onChange={setSearchDraft}
            onSubmit={applySearchState}
            categoryQuickLinks={categories}
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
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
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

          <div className="glass-card flex w-full min-w-0 items-center gap-2 rounded-[1.75rem] border border-[var(--border-warm)] px-4 py-2.5 shadow-warm sm:w-auto">
            <label
              htmlFor="sort-filter"
              className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]"
            >
              Sort
            </label>
            <select
              id="sort-filter"
              name="sort"
              value={sortDraft}
              onChange={(event) => setSortDraft(event.target.value)}
              className="min-w-0 flex-1 bg-transparent pr-6 text-sm font-medium text-[var(--foreground)] focus:outline-none"
              aria-label="Sort products"
            >
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
              <option value="best_selling">Best-selling</option>
              <option value="top_rated">Top-rated</option>
            </select>
          </div>

          <div className="glass-card flex w-full min-w-0 items-center gap-2 rounded-[1.75rem] border border-[var(--border-warm)] px-4 py-2.5 shadow-warm sm:w-auto">
            <label
              htmlFor="min-price-filter"
              className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]"
            >
              ₹
            </label>
            <input
              id="min-price-filter"
              type="number"
              min={0}
              inputMode="decimal"
              value={minPriceDraft}
              onChange={(event) => setMinPriceDraft(event.target.value)}
              placeholder="Min"
              className="w-20 bg-transparent text-sm text-[var(--foreground)] focus:outline-none"
              aria-label="Minimum price"
            />
            <span className="text-xs text-[var(--text-muted)]">to</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={maxPriceDraft}
              onChange={(event) => setMaxPriceDraft(event.target.value)}
              placeholder="Max"
              className="w-20 bg-transparent text-sm text-[var(--foreground)] focus:outline-none"
              aria-label="Maximum price"
            />
          </div>

          <div className="glass-card flex items-center gap-2 rounded-[1.75rem] border border-[var(--border-warm)] px-4 py-2.5 shadow-warm">
            <input
              id="stock-filter"
              type="checkbox"
              checked={inStockDraft}
              onChange={(event) => setInStockDraft(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-warm)] text-[var(--btn-primary)] focus:ring-[var(--accent-rose)]"
            />
            <label
              htmlFor="stock-filter"
              className="text-sm font-semibold text-[var(--text-secondary)]"
            >
              In stock
            </label>
          </div>

          <div className="glass-card flex w-full min-w-0 items-center gap-2 rounded-[1.75rem] border border-[var(--border-warm)] px-4 py-2.5 shadow-warm sm:w-auto">
            <label
              htmlFor="rating-filter"
              className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]"
            >
              Rating
            </label>
            <select
              id="rating-filter"
              value={minRatingDraft}
              onChange={(event) => setMinRatingDraft(event.target.value)}
              className="min-w-0 flex-1 bg-transparent pr-6 text-sm font-medium text-[var(--foreground)] focus:outline-none"
              aria-label="Minimum rating"
            >
              <option value="">Any</option>
              <option value="4">4★ & up</option>
              <option value="3">3★ & up</option>
              <option value="2">2★ & up</option>
            </select>
          </div>

          <div className="glass-card flex w-full min-w-0 items-center gap-2 rounded-[1.75rem] border border-[var(--border-warm)] px-4 py-2.5 shadow-warm sm:w-auto">
            <label
              htmlFor="variant-filter"
              className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]"
            >
              Variants
            </label>
            <select
              id="variant-filter"
              value={variantDraft}
              onChange={(event) =>
                setVariantDraft(event.target.value as VariantOption)
              }
              className="min-w-0 flex-1 bg-transparent pr-6 text-sm font-medium text-[var(--foreground)] focus:outline-none"
              aria-label="Filter by variants"
            >
              <option value="all">All</option>
              <option value="single">Single</option>
              <option value="multiple">Multiple</option>
            </select>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="submit"
              className="flex-1 rounded-full bg-[var(--btn-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-warm transition-all duration-200 hover:shadow-warm-lg sm:flex-none"
            >
              Apply
            </button>
            {hasActiveFilters && (
              <Link
                href={resetHref}
                className="flex-1 rounded-full border border-[var(--border-warm)] bg-[var(--surface)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--foreground)] shadow-warm transition-colors duration-200 hover:border-[var(--accent-rose)] sm:flex-none"
              >
                Reset
              </Link>
            )}
          </div>
        </div>
      </form>

      {visibleProducts.length === 0 ? (
        <div className="space-y-4">
          <EmptyState title="No products found" message={emptyMessage} />

          {(suggestions.length > 0 || trending.length > 0) && (
            <div className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-4 shadow-warm">
              {suggestions.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">
                    Did you mean
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => {
                          setSearchDraft(entry)
                          const params = new URLSearchParams()
                          params.set('q', entry)
                          if (selectedCategory !== DEFAULT_CATEGORY) {
                            params.set('category', selectedCategory)
                          }
                          router.push(
                            localizePath(`/shop?${params.toString()}#products`),
                            {
                              scroll: false,
                            }
                          )
                        }}
                        className="rounded-full bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent-blush)]"
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {trending.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">
                    Trending products
                  </p>
                  <ul className="space-y-1 text-sm">
                    {trending.map((product) => (
                      <li key={product.id}>
                        <Link
                          href={`/products/${product.id}`}
                          className="text-[var(--btn-primary)] hover:underline"
                        >
                          {product.name}
                        </Link>
                        <span className="ml-2 text-xs text-[var(--text-muted)]">
                          {product.category}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                formatPrice={formatPrice}
                index={index}
                query={search}
              />
            ))}
          </div>

          <div className="mt-8 border-t border-[var(--border-warm)] pt-6">
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Showing {visibleProducts.length} product
              {visibleProducts.length === 1 ? '' : 's'}
              {canLoadMore ? ' so far' : '.'}
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
  )
}

export default ProductGrid
