"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly badge?: number;
  readonly keywords?: readonly string[];
}

interface NavGroup {
  readonly label: string;
  readonly href?: string;
  readonly items?: readonly NavItem[];
}

interface AdminNavLinksClientProps {
  readonly failedEmailCount: number;
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Dashboard",
    href: "/admin",
  },
  {
    label: "Catalog",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        keywords: ["inventory", "stock", "items"],
      },
      {
        href: "/admin/categories",
        label: "Categories",
        keywords: ["tags", "groups"],
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        href: "/admin/orders",
        label: "Orders",
        keywords: ["purchases", "transactions", "sales"],
      },
      {
        href: "/admin/users",
        label: "Users",
        keywords: ["customers", "accounts", "people"],
      },
      {
        href: "/admin/reviews",
        label: "Reviews",
        keywords: ["ratings", "feedback"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/admin/search",
        label: "Search",
        keywords: ["reindex", "indexing"],
      },
      {
        href: "/admin/email-failures",
        label: "Email Failures",
        keywords: ["notifications", "errors", "emails"],
      },
    ],
  },
];

function getAllNavItems(failedEmailCount: number): NavItem[] {
  const items: NavItem[] = [];
  for (const group of NAV_GROUPS) {
    if (group.href) {
      items.push({ href: group.href, label: group.label });
    }
    if (group.items) {
      for (const item of group.items) {
        items.push({
          ...item,
          badge:
            item.href === "/admin/email-failures"
              ? failedEmailCount
              : undefined,
        });
      }
    }
  }
  return items;
}

function DropdownGroup({
  group,
  failedEmailCount,
}: {
  readonly group: NavGroup;
  readonly failedEmailCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!group.items) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
      >
        {group.label}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
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
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px] z-50"
        >
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              {item.label}
              {item.href === "/admin/email-failures" &&
                failedEmailCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
                    {failedEmailCount > 99 ? "99+" : failedEmailCount}
                  </span>
                )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CommandPalette({
  open,
  onClose,
  failedEmailCount,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly failedEmailCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const allItems = useMemo(
    () => getAllNavItems(failedEmailCount),
    [failedEmailCount],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q) ||
        item.keywords?.some((kw) => kw.includes(q)),
    );
  }, [query, allItems]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Delay focus to after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        onClose();
        router.push(filtered[selectedIndex].href);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop dismiss */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <dialog
        open
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700 p-0"
        aria-label="Admin quick navigation"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <svg
            className="w-5 h-5 text-gray-400"
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
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">
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
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="flex items-center gap-2">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                    {i === selectedIndex && (
                      <kbd className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
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
  );
}

export function AdminNavLinksClient({
  failedEmailCount,
}: AdminNavLinksClientProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 py-3 whitespace-nowrap">
            {NAV_GROUPS.map((group) =>
              group.href ? (
                <Link
                  key={group.label}
                  href={group.href}
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  {group.label}
                </Link>
              ) : (
                <DropdownGroup
                  key={group.label}
                  group={group}
                  failedEmailCount={failedEmailCount}
                />
              ),
            )}

            <div className="ml-auto">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5"
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
                <kbd className="hidden sm:inline-flex items-center text-[10px] font-medium text-gray-400 ml-1">
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
  );
}
