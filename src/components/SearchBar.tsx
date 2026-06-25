'use client'

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from '@/components/ui/LocaleLink'
import { useSession } from 'next-auth/react'
import { useDebounce } from '@/hooks/useDebounce'

type SuggestResponse = {
  query: string
  products: Array<{ id: string; label: string; category: string }>
  categories: string[]
  popular: string[]
}

type SuggestionSectionKey = 'recent' | 'products' | 'categories' | 'popular'

interface SuggestionOption {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly section: SuggestionSectionKey
  readonly index: number
  readonly secondaryLabel?: string
}

interface SuggestionSection {
  readonly key: SuggestionSectionKey
  readonly title: string
  readonly options: SuggestionOption[]
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
  const listboxId = useId()
  const statusId = useId()
  const [suggestions, setSuggestions] = useState<SuggestResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLElement | null>>([])
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

  const suggestionSections = useMemo(() => {
    const sections: SuggestionSection[] = []
    let nextIndex = 0

    const appendSection = (
      key: SuggestionSectionKey,
      title: string,
      items: Array<{
        readonly label: string
        readonly value: string
        readonly secondaryLabel?: string
      }>
    ) => {
      if (!items.length) {
        return
      }

      sections.push({
        key,
        title,
        options: items.map((item, index) => ({
          id: `${listboxId}-${key}-${index}`,
          label: item.label,
          value: item.value,
          section: key,
          secondaryLabel: item.secondaryLabel,
          index: nextIndex++,
        })),
      })
    }

    appendSection(
      'recent',
      'Recent searches',
      recent.map((entry) => ({ label: entry, value: entry }))
    )
    appendSection(
      'products',
      'Products',
      (suggestions?.products ?? []).map((product) => ({
        label: product.label,
        value: product.label,
        secondaryLabel: product.category,
      }))
    )
    appendSection(
      'categories',
      'Categories',
      (suggestions?.categories ?? []).map((category) => ({
        label: category,
        value: category,
      }))
    )
    appendSection(
      'popular',
      'Popular searches',
      (suggestions?.popular ?? []).map((term) => ({
        label: term,
        value: term,
      }))
    )

    return sections
  }, [listboxId, recent, suggestions])

  const flatOptions = useMemo(
    () => suggestionSections.flatMap((section) => section.options),
    [suggestionSections]
  )

  useEffect(() => {
    setActiveIndex((current) => {
      if (!open || !flatOptions.length) {
        return -1
      }

      return current >= flatOptions.length ? flatOptions.length - 1 : current
    })
  }, [flatOptions.length, open])

  useEffect(() => {
    if (activeIndex < 0) {
      return
    }

    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

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
    setActiveIndex(-1)
  }

  const activeOption = activeIndex >= 0 ? flatOptions[activeIndex] : undefined
  const resultsDescription = isLoading
    ? 'Searching suggestions.'
    : flatOptions.length
      ? `${flatOptions.length} suggestion${flatOptions.length === 1 ? '' : 's'} available.`
      : value.trim()
        ? 'No suggestions available.'
        : recent.length
          ? `${recent.length} recent ${recent.length === 1 ? 'search is' : 'searches are'} available.`
          : 'No suggestions available.'

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="search"
        role="combobox"
        name="q"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          setActiveIndex(-1)
          onChange(event.target.value)
        }}
        onFocus={() => {
          setOpen(true)
          setActiveIndex(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            if (!open) {
              setOpen(true)
            }

            if (!flatOptions.length) {
              return
            }

            event.preventDefault()
            setActiveIndex((current) =>
              current < flatOptions.length - 1 ? current + 1 : 0
            )
            return
          }

          if (event.key === 'ArrowUp') {
            if (!open) {
              setOpen(true)
            }

            if (!flatOptions.length) {
              return
            }

            event.preventDefault()
            setActiveIndex((current) =>
              current > 0 ? current - 1 : flatOptions.length - 1
            )
            return
          }

          if (event.key === 'Home' && flatOptions.length) {
            event.preventDefault()
            setActiveIndex(0)
            return
          }

          if (event.key === 'End' && flatOptions.length) {
            event.preventDefault()
            setActiveIndex(flatOptions.length - 1)
            return
          }

          if (event.key === 'Escape') {
            setOpen(false)
            setActiveIndex(-1)
            return
          }

          if (event.key === 'Enter') {
            if (activeOption) {
              event.preventDefault()
              applySuggestion(activeOption.value)
              return
            }

            persistRecent(value)
            onSubmit()
            setOpen(false)
            setActiveIndex(-1)
          }
        }}
        placeholder="Search products..."
        className="glass-card w-full rounded-full border border-[var(--border-warm)] py-3 pl-11 pr-4 text-[var(--foreground)] shadow-warm transition-all duration-200 placeholder-[var(--text-muted)] focus:border-[var(--accent-rose)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30"
        aria-label="Search products"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={!isLoading && flatOptions.length ? listboxId : undefined}
        aria-activedescendant={
          !isLoading && activeOption ? activeOption.id : undefined
        }
        aria-describedby={open ? statusId : undefined}
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
          <p id={statusId} role="status" aria-live="polite" className="sr-only">
            {resultsDescription}
          </p>
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-[var(--text-muted)]">
              Searching…
            </p>
          ) : (
            <>
              {!!flatOptions.length && (
                <div
                  id={listboxId}
                  role="listbox"
                  aria-label="Search suggestions"
                  className="max-h-96 overflow-y-auto"
                >
                  {suggestionSections.map((section, sectionIndex) => {
                    const labelId = `${listboxId}-${section.key}-label`
                    const isLastSection =
                      sectionIndex === suggestionSections.length - 1

                    return (
                      <div
                        key={section.key}
                        role="group"
                        aria-labelledby={labelId}
                        className={
                          !isLastSection
                            ? 'border-b border-[var(--border-warm)] px-4 py-3'
                            : 'px-4 py-3'
                        }
                      >
                        <p
                          id={labelId}
                          className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                        >
                          {section.title}
                        </p>
                        <ul
                          className={
                            section.key === 'products'
                              ? 'space-y-1'
                              : 'flex flex-wrap gap-2'
                          }
                        >
                          {section.options.map((option) => {
                            const isActive = option.index === activeIndex

                            return (
                              <li
                                key={option.id}
                                id={option.id}
                                role="option"
                                aria-selected={isActive}
                                ref={(element) => {
                                  optionRefs.current[option.index] = element
                                }}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() =>
                                  setActiveIndex(option.index)
                                }
                                onClick={() => applySuggestion(option.value)}
                                className={
                                  section.key === 'products'
                                    ? `w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-sm text-[var(--foreground)] transition-colors ${
                                        isActive
                                          ? 'bg-[var(--surface-elevated)] ring-1 ring-[var(--accent-rose)]/25'
                                          : 'hover:bg-[var(--surface-elevated)]'
                                      }`
                                    : section.key === 'popular'
                                      ? `cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium text-[var(--foreground)] transition-colors ${
                                          isActive
                                            ? 'bg-[var(--accent-blush)] ring-1 ring-[var(--accent-rose)]/25'
                                            : 'bg-[var(--surface-elevated)] hover:bg-[var(--accent-blush)]'
                                        }`
                                      : `cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium text-[var(--foreground)] transition-colors ${
                                          isActive
                                            ? 'border-[var(--accent-rose)] bg-[var(--surface-elevated)] ring-1 ring-[var(--accent-rose)]/25'
                                            : 'border-[var(--border-warm)] hover:border-[var(--accent-rose)]'
                                        }`
                                }
                              >
                                {section.key === 'products' ? (
                                  <>
                                    {markMatches(option.label, value)}
                                    {option.secondaryLabel && (
                                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                                        {option.secondaryLabel}
                                      </span>
                                    )}
                                  </>
                                ) : section.key === 'popular' ? (
                                  option.label
                                ) : (
                                  markMatches(option.label, value)
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
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
