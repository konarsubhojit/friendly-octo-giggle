'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from '@/components/ui/LocaleLink'
import { useSession } from 'next-auth/react'
import { useDebounce } from '@/hooks/useDebounce'

type SuggestResponse = {
  query: string
  products: Array<{ id: string; label: string; category: string }>
  categories: string[]
  popular: string[]
}

interface SearchBarProps {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly onSubmit: () => void
  readonly categoryQuickLinks?: string[]
}

const MAX_RECENT = 6

const markMatches = (text: string, query: string) => {
  const normalized = query.trim()
  if (!normalized) {
    return <>{text}</>
  }

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  const regex = new RegExp(`(${escaped})`, 'ig')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) => {
        return index % 2 === 1 ? (
          <mark
            key={`m-${index}-${part}`}
            className="rounded bg-[var(--accent-blush)] px-0.5 text-[inherit]"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={`s-${index}-${part}`}>{part}</Fragment>
        )
      })}
    </>
  )
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  categoryQuickLinks = [],
}: SearchBarProps) {
  const { data: session } = useSession()
  const [suggestions, setSuggestions] = useState<SuggestResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debouncedValue = useDebounce(value.trim(), 160)

  const storageKey = useMemo(
    () => `search:recent:${session?.user?.id ?? 'guest'}`,
    [session?.user?.id]
  )

  useEffect(() => {
    try {
      const parsed = JSON.parse(
        globalThis.localStorage.getItem(storageKey) ?? '[]'
      ) as unknown
      if (Array.isArray(parsed)) {
        const timer = globalThis.setTimeout(() => {
          setRecent(
            parsed
              .filter((entry): entry is string => typeof entry === 'string')
              .slice(0, MAX_RECENT)
          )
        }, 0)
        return () => globalThis.clearTimeout(timer)
      }
    } catch {
      const timer = globalThis.setTimeout(() => {
        setRecent([])
      }, 0)
      return () => globalThis.clearTimeout(timer)
    }
  }, [storageKey])

  useEffect(() => {
    if (!debouncedValue) {
      const resetTimer = globalThis.setTimeout(() => {
        setSuggestions(null)
        setIsLoading(false)
      }, 0)
      return () => globalThis.clearTimeout(resetTimer)
    }

    if (!open) {
      return
    }

    const controller = new AbortController()
    const loadingTimer = globalThis.setTimeout(() => {
      setIsLoading(true)
    }, 0)

    const loadSuggestions = async () => {
      try {
        const params = new URLSearchParams({ q: debouncedValue, limit: '6' })
        const response = await fetch(
          `/api/search/suggest?${params.toString()}`,
          {
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error('suggest request failed')
        }

        const payload = (await response.json()) as {
          data?: SuggestResponse
        }

        setSuggestions(payload.data ?? null)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSuggestions(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadSuggestions()

    return () => {
      globalThis.clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [debouncedValue, open])

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const persistRecent = (query: string) => {
    const normalized = query.trim()
    if (!normalized) {
      return
    }

    const nextRecent = [
      normalized,
      ...recent.filter((item) => item !== normalized),
    ].slice(0, MAX_RECENT)
    setRecent(nextRecent)
    globalThis.localStorage.setItem(storageKey, JSON.stringify(nextRecent))
  }

  const applySuggestion = (query: string) => {
    onChange(query)
    persistRecent(query)
    onSubmit()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="search"
        name="q"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            return
          }

          if (event.key === 'Enter') {
            persistRecent(value)
            onSubmit()
            setOpen(false)
          }
        }}
        placeholder="Search products..."
        className="glass-card w-full rounded-full border border-[var(--border-warm)] py-3 pl-11 pr-4 text-[var(--foreground)] shadow-warm transition-all duration-200 placeholder-[var(--text-muted)] focus:border-[var(--accent-rose)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30"
        aria-label="Search products"
      />

      <svg
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--accent-rose)]"
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

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-warm-lg">
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-[var(--text-muted)]">
              Searching…
            </p>
          ) : (
            <>
              {!!recent.length && (
                <div className="border-b border-[var(--border-warm)] px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Recent searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => applySuggestion(entry)}
                        className="rounded-full border border-[var(--border-warm)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent-rose)]"
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!!suggestions?.products.length && (
                <div className="border-b border-[var(--border-warm)] px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Products
                  </p>
                  <ul className="space-y-1">
                    {suggestions.products.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => applySuggestion(product.label)}
                          className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
                        >
                          {markMatches(product.label, value)}
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            {product.category}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!!suggestions?.categories.length && (
                <div className="border-b border-[var(--border-warm)] px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Categories
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => applySuggestion(category)}
                        className="rounded-full border border-[var(--border-warm)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent-rose)]"
                      >
                        {markMatches(category, value)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!!suggestions?.popular.length && (
                <div className="px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Popular searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.popular.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => applySuggestion(term)}
                        className="rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent-blush)]"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!!categoryQuickLinks.length && (
                <div className="border-t border-[var(--border-warm)] px-4 py-3 sm:hidden">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Category quick links
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categoryQuickLinks.slice(0, 6).map((category) => (
                      <Link
                        key={category}
                        href={`/shop?category=${encodeURIComponent(category)}#products`}
                        onClick={() => setOpen(false)}
                        className="rounded-full border border-[var(--border-warm)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                      >
                        {category}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
