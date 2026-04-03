'use client'

import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCurrency } from '@/contexts/CurrencyContext'

interface ProductSearchProps {
  readonly onNavigate?: () => void
}

interface SearchResult {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
}

interface SearchResultHit {
  readonly id: string
  readonly content?: Partial<
    Pick<SearchResult, 'name' | 'description' | 'price' | 'category'>
  >
  readonly metadata?: {
    readonly image?: string
  }
}

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_RESULTS_LIMIT = 8

function isSearchResultHit(
  item: SearchResult | SearchResultHit
): item is SearchResultHit {
  return 'content' in item
}

function normalizeSearchResult(
  item: SearchResult | SearchResultHit
): SearchResult | null {
  const content = isSearchResultHit(item)
    ? item.content
    : {
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
      }
  const rawPrice = content?.price
  const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice)

  if (!content?.name || !Number.isFinite(price)) {
    return null
  }

  return {
    id: item.id,
    name: content.name,
    description: content.description ?? '',
    price,
    image: (isSearchResultHit(item) ? item.metadata?.image : item.image) ?? '',
    category: content.category ?? '',
  }
}

// ─── Highlight matching text ─────────────────────────────

function HighlightText({
  text,
  query,
}: {
  readonly text?: string | null
  readonly query: string
}) {
  const safeText = text ?? ''

  if (!query.trim()) return <>{safeText}</>
  const escapedQuery = query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = safeText.split(regex)
  return (
    <>
      {parts.map((part, index) => {
        const key = `${part}-${index}`
        return index % 2 === 1 ? (
          <mark
            key={key}
            className="bg-transparent text-[var(--accent-rose)] font-semibold"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={key}>{part}</Fragment>
        )
      })}
    </>
  )
}

// ─── Component ───────────────────────────────────────────

export default function ProductSearch({ onNavigate }: ProductSearchProps) {
  const router = useRouter()
  const { formatPrice } = useCurrency()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setResults([])
      setIsSearching(false)
    }
  }, [open])

  useEffect(() => {
    const clearDebounce = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }

    const abortController = new AbortController()

    clearDebounce()

    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: String(SEARCH_RESULTS_LIMIT),
        })
        const res = await fetch(`/api/search?${params}`, {
          signal: abortController.signal,
        })
        if (!res.ok) throw new Error('search failed')
        const data = await res.json()
        const rawItems = (data.data?.results ?? data.results ?? []) as Array<
          SearchResult | SearchResultHit
        >
        setResults(
          rawItems
            .map((item) => normalizeSearchResult(item))
            .filter((item): item is SearchResult => item !== null)
            .slice(0, SEARCH_RESULTS_LIMIT)
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setResults([])
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearDebounce()
      abortController.abort()
    }
  }, [query])

  const openDialog = useCallback(() => {
    setOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setActiveIndex(-1)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDialog()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, closeDialog])

  // Cmd/Ctrl+K shortcut to open
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Clamp activeIndex — automatically resets when results shrink
  const clampedIndex = activeIndex >= results.length ? -1 : activeIndex

  const navigate = useCallback(
    (productId: string) => {
      closeDialog()
      onNavigate?.()
      router.push(`/products/${productId}`)
    },
    [router, closeDialog, onNavigate]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
      } else if (
        e.key === 'Enter' &&
        clampedIndex >= 0 &&
        results[clampedIndex]
      ) {
        e.preventDefault()
        navigate(results[clampedIndex].id)
      }
    },
    [results, clampedIndex, navigate]
  )

  // Scroll active item into view
  useEffect(() => {
    if (clampedIndex < 0 || !listRef.current) return
    const item = listRef.current.children[clampedIndex] as
      | HTMLElement
      | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [clampedIndex])

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="w-full max-w-[220px] sm:max-w-xs flex items-center gap-2 border border-[var(--border-warm)] bg-[var(--surface)] text-[var(--text-muted)] rounded-full px-4 py-1.5 text-sm hover:border-[var(--accent-rose)] transition-colors cursor-pointer"
        aria-label="Search products"
      >
        <svg
          className="w-4 h-4 shrink-0"
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
        <span className="truncate">Search products...</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-auto rounded border border-[var(--border-warm)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
          ⌘K
        </kbd>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
              onClick={() => closeDialog()}
              aria-label="Close search"
              tabIndex={-1}
            />
            <div
              ref={dialogRef}
              role="search"
              aria-label="Product search"
              className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border-warm)] rounded-2xl shadow-warm-lg overflow-hidden animate-scale-in"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-warm)]">
                <svg
                  className="w-5 h-5 text-[var(--accent-rose)] shrink-0"
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
                  ref={inputRef}
                  type="search"
                  placeholder="Search products by name, category..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-muted)] text-sm outline-none"
                  aria-label="Search products"
                />
                <button
                  onClick={closeDialog}
                  className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  aria-label="Close search"
                >
                  <kbd className="inline-flex items-center rounded border border-[var(--border-warm)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium">
                    ESC
                  </kbd>
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
                {isSearching && (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    Searching...
                  </div>
                )}

                {!isSearching && query.trim() && results.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No products found for &ldquo;{query}&rdquo;
                  </div>
                )}

                {!isSearching && results.length > 0 && (
                  <ul
                    ref={listRef}
                    id="search-results-list"
                    aria-label="Search results"
                    className="py-2"
                  >
                    {results.map((product, i) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          tabIndex={-1}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                            clampedIndex === i
                              ? 'bg-[var(--accent-blush)]'
                              : 'hover:bg-[var(--accent-blush)]/50'
                          }`}
                          onClick={() => navigate(product.id)}
                          onMouseEnter={() => setActiveIndex(i)}
                        >
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)] overflow-hidden shrink-0">
                            {product.image ? (
                              <Image
                                src={product.image}
                                alt=""
                                fill
                                className="object-contain p-1"
                                sizes="40px"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="text-xs font-semibold uppercase text-[var(--accent-rose)]"
                              >
                                {(
                                  product.name ||
                                  product.category ||
                                  '?'
                                ).slice(0, 1)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                              <HighlightText
                                text={product.name}
                                query={query}
                              />
                            </p>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              <HighlightText
                                text={product.category}
                                query={query}
                              />
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-[var(--btn-primary)] shrink-0">
                            {formatPrice(product.price)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {!query.trim() && (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    Start typing to search products...
                  </div>
                )}
              </div>

              {results.length > 0 && (
                <div className="px-4 py-2 border-t border-[var(--border-warm)] flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <kbd className="inline-flex items-center rounded border border-[var(--border-warm)] bg-[var(--background)] px-1 py-0.5 font-medium">
                      ↑↓
                    </kbd>{' '}
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="inline-flex items-center rounded border border-[var(--border-warm)] bg-[var(--background)] px-1 py-0.5 font-medium">
                      ↵
                    </kbd>{' '}
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="inline-flex items-center rounded border border-[var(--border-warm)] bg-[var(--background)] px-1 py-0.5 font-medium">
                      esc
                    </kbd>{' '}
                    close
                  </span>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
