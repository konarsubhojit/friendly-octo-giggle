'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'

interface NavItem {
  readonly href: string
  readonly label: string
  readonly badge?: number
  readonly keywords?: readonly string[]
}

interface NavGroup {
  readonly label: string
  readonly href?: string
  readonly items?: readonly NavItem[]
}

interface AdminNavLinksClientProps {
  readonly failedEmailCount: number
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Dashboard',
    href: '/admin',
  },
  {
    label: 'Catalog',
    items: [
      {
        href: '/admin/products',
        label: 'Products',
        keywords: ['inventory', 'stock', 'items'],
      },
      {
        href: '/admin/categories',
        label: 'Categories',
        keywords: ['tags', 'groups'],
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        href: '/admin/orders',
        label: 'Orders',
        keywords: ['purchases', 'transactions', 'sales'],
      },
      {
        href: '/admin/users',
        label: 'Users',
        keywords: ['customers', 'accounts', 'people'],
      },
      {
        href: '/admin/reviews',
        label: 'Reviews',
        keywords: ['ratings', 'feedback'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        href: '/admin/search',
        label: 'Search',
        keywords: ['reindex', 'indexing'],
      },
      {
        href: '/admin/email-failures',
        label: 'Email Failures',
        keywords: ['notifications', 'errors', 'emails'],
      },
      {
        href: '/admin/checkout-requests',
        label: 'Checkout Queue',
        keywords: ['checkout', 'queue', 'orders', 'worker'],
      },
    ],
  },
]

function getAllNavItems(failedEmailCount: number): NavItem[] {
  const items: NavItem[] = []
  for (const group of NAV_GROUPS) {
    if (group.href) {
      items.push({ href: group.href, label: group.label })
    }
    if (group.items) {
      for (const item of group.items) {
        items.push({
          ...item,
          badge:
            item.href === '/admin/email-failures'
              ? failedEmailCount
              : undefined,
        })
      }
    }
  }
  return items
}

function DropdownGroup({
  group,
  failedEmailCount,
}: {
  readonly group: NavGroup
  readonly failedEmailCount: number
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return

    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 176
    const viewportPadding = 12

    setMenuStyle({
      top: rect.bottom,
      left: Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - menuWidth - viewportPadding)
      ),
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return

    updateMenuPosition()

    const handleViewportChange = () => updateMenuPosition()
    window.addEventListener('scroll', handleViewportChange, { passive: true })
    window.addEventListener('resize', handleViewportChange)

    return () => {
      window.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [open, updateMenuPosition])

  if (!group.items) return null

  const handleToggle = () => {
    if (!open) {
      updateMenuPosition()
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 rounded-full border border-transparent px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-200 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-50"
      >
        {group.label}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open &&
        globalThis.window !== undefined &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuStyle.top,
              left: menuStyle.left,
            }}
            className="z-50 min-w-[176px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white/95 py-2 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.48)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-[0_24px_60px_-32px_rgba(2,6,23,0.9)]"
          >
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              >
                {item.label}
                {item.href === '/admin/email-failures' &&
                  failedEmailCount > 0 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
                      {failedEmailCount > 99 ? '99+' : failedEmailCount}
                    </span>
                  )}
              </Link>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

function CommandPalette({
  open,
  onClose,
  failedEmailCount,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly failedEmailCount: number
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [prevOpen, setPrevOpen] = useState(open)
  const allItems = useMemo(
    () => getAllNavItems(failedEmailCount),
    [failedEmailCount]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q) ||
        item.keywords?.some((kw) => kw.includes(q))
    )
  }, [query, allItems])

  // Reset state when the dialog opens (state-based prev tracking)
  if (open && !prevOpen) {
    setQuery('')
    setSelectedIndex(0)
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const [prevFilteredLen, setPrevFilteredLen] = useState(filtered.length)
  if (filtered.length !== prevFilteredLen) {
    setSelectedIndex(0)
    setPrevFilteredLen(filtered.length)
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault()
        onClose()
        router.push(filtered[selectedIndex].href)
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [filtered, selectedIndex, onClose, router]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <button
        type="button"
        className="fixed inset-0 bg-black/50 cursor-default dark:bg-slate-950/70"
        onClick={onClose}
        aria-label="Close navigation"
        tabIndex={-1}
      />
      <dialog
        open
        className="relative mx-4 w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/95 p-0 shadow-[0_30px_90px_-42px_rgba(15,23,42,0.68)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-[0_30px_90px_-42px_rgba(2,6,23,0.95)]"
        aria-label="Admin quick navigation"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <svg
            className="h-5 w-5 text-slate-400 dark:text-slate-500"
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
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to admin section..."
            className="flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-50 dark:placeholder:text-slate-500"
          />
          <kbd className="hidden items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching sections
            </li>
          ) : (
            filtered.map((item, i) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm transition ${
                    i === selectedIndex
                      ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="flex items-center gap-2">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                    {i === selectedIndex && (
                      <kbd className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        ↵
                      </kbd>
                    )}
                  </span>
                </a>
              </li>
            ))
          )}
        </ul>
      </dialog>
    </div>
  )
}

export function AdminNavLinksClient({
  failedEmailCount,
}: AdminNavLinksClientProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <nav className="sticky top-0 z-20 overflow-x-auto border-b border-white/70 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="flex min-w-max items-center gap-3 whitespace-nowrap pr-2 sm:gap-4">
                {NAV_GROUPS.map((group) =>
                  group.href ? (
                    <Link
                      key={group.label}
                      href={group.href}
                      className="rounded-full border border-transparent px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-200 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <DropdownGroup
                      key={group.label}
                      group={group}
                      failedEmailCount={failedEmailCount}
                    />
                  )
                )}
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
                aria-label="Quick navigation"
              >
                <svg
                  className="w-4 h-4"
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
                <span className="hidden sm:inline">Jump to...</span>
                <kbd className="ml-1 hidden items-center text-[10px] font-medium text-slate-400 dark:text-slate-500 sm:inline-flex">
                  ⌘K
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        failedEmailCount={failedEmailCount}
      />
    </>
  )
}
