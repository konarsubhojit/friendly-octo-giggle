'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signOut } from 'next-auth/react'
import Link from '@/components/ui/LocaleLink'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useLocale } from '@/contexts/LocaleContext'

export interface UserMenuUser {
  readonly name?: string | null
  readonly email?: string | null
  readonly image?: string | null
  readonly role?: string
}

export interface UserMenuProps {
  readonly user: UserMenuUser
  readonly menuOpen: boolean
  readonly setMenuOpen: (open: boolean) => void
  readonly menuRef: React.RefObject<HTMLDivElement | null>
}

export function UserMenu({
  user,
  menuOpen,
  setMenuOpen,
  menuRef,
}: UserMenuProps) {
  const [signingOut, setSigningOut] = useState(false)
  const { t, localizePath } = useLocale()

  async function handleSignOut() {
    setMenuOpen(false)
    setSigningOut(true)
    try {
      await signOut({ callbackUrl: localizePath('/') })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label={t('header.userMenu')}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls="user-menu"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt=""
            width={32}
            height={32}
            className="rounded-full ring-2 ring-[var(--border-warm)]"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] flex items-center justify-center text-white text-sm font-bold">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
        <svg
          className="w-4 h-4 text-[var(--text-secondary)] hidden sm:block"
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

      {menuOpen && (
        <div
          id="user-menu"
          className="absolute right-0 mt-2 w-56 bg-[var(--surface)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] py-2 z-50 animate-scale-in"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-[var(--border-warm)]">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              {user.name}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate">
              {user.email}
            </p>
          </div>
          <Link
            href={localizePath('/account')}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors rounded-lg mx-1"
            role="menuitem"
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {t('header.account')}
          </Link>
          <Link
            href={localizePath('/orders')}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors rounded-lg mx-1"
            role="menuitem"
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            {t('header.orders')}
          </Link>
          <Link
            href={localizePath('/wishlist')}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors rounded-lg mx-1"
            role="menuitem"
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
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {t('header.wishlist')}
          </Link>
          {user.role === 'ADMIN' && (
            <Link
              href={localizePath('/admin')}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors rounded-lg mx-1"
              role="menuitem"
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {t('header.admin')}
            </Link>
          )}
          <div className="border-t border-[var(--border-warm)] mt-1 pt-1">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              aria-busy={signingOut}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50/50 transition-colors rounded-lg mx-1 disabled:opacity-60 disabled:cursor-not-allowed"
              role="menuitem"
            >
              {signingOut ? (
                <LoadingSpinner size="h-4 w-4" color="text-red-500" />
              ) : (
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              )}
              {signingOut ? t('header.signingOut') : t('header.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
