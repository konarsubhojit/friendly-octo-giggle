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
      return
    }

    const resetTimer = globalThis.setTimeout(() => {
      setResults([])
      setIsSearching(false)
    }, 0)

    return () => {
      globalThis.clearTimeout(resetTimer)
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
      const resetTimer = globalThis.setTimeout(() => {
        setResults([])
        setIsSearching(false)
      }, 0)

      return () => {
        globalThis.clearTimeout(resetTimer)
        abortController.abort()
      }
    }

    const searchingTimer = globalThis.setTimeout(() => {
      setIsSearching(true)
    }, 0)

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
      globalThis.clearTimeout(searchingTimer)
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
            d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="truncate">Search products...</span>
        <kbd className="ml-auto hidden rounded-md border border-[var(--border-warm)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200]">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={closeDialog}
            />

            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Search products"
              className="absolute left-1/2 top-[10%] w-[min(92vw,680px)] -translate-x-1/2 rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-warm)] px-4 py-3">
                <svg
                  className="h-5 w-5 text-[var(--text-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActiveIndex(-1)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search by name, description, category..."
                  className="w-full bg-transparent text-[15px] text-[var(--foreground)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                >
                  ESC
                </button>
              </div>

              <ul
                ref={listRef}
                role="listbox"
                aria-label="Search results"
                className="max-h-[60vh] overflow-auto p-2"
              >
                {isSearching ? (
                  <li className="px-3 py-4 text-sm text-[var(--text-muted)]">
                    Searching...
                  </li>
                ) : results.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                    {query.trim()
                      ? 'No products found'
                      : 'Start typing to search products'}
                  </li>
                ) : (
                  results.map((item, index) => {
                    const isActive = index === clampedIndex
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => navigate(item.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                            isActive
                              ? 'bg-[var(--accent-blush)]'
                              : 'hover:bg-[var(--surface-elevated)]'
                          }`}
                        >
                          <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[var(--surface-elevated)]">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                              <HighlightText text={item.name} query={query} />
                            </div>
                            <div className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                              <HighlightText
                                text={item.description}
                                query={query}
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-[var(--foreground)]">
                              {formatPrice(item.price)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                              {item.category}
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
