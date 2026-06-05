'use client'

import dynamic from 'next/dynamic'
import Link from '@/components/ui/LocaleLink'
import { GradientButton } from '@/components/ui/GradientButton'
import { useLocale } from '@/contexts/LocaleContext'

const ProductSearch = dynamic(
  () => import('@/features/product/components/ProductSearch'),
  {
    loading: () => (
      <div
        className="h-10 w-10 rounded-full bg-[var(--accent-blush)]/50 sm:w-64 sm:rounded-2xl"
        aria-hidden="true"
      />
    ),
  }
)

export interface MobileNavProps {
  readonly isLoggedIn: boolean
  readonly closeMobileNav: () => void
  readonly onLoginClick: () => void
}

export function MobileNav({
  isLoggedIn,
  closeMobileNav,
  onLoginClick,
}: MobileNavProps) {
  const { t, localizePath } = useLocale()
  return (
    <div
      id="mobile-nav-drawer"
      className="md:hidden bg-[var(--background)]/95 backdrop-blur-lg border-t border-[var(--border-warm)]/40 shadow-warm animate-fade-in"
    >
      <nav className="mx-auto flex w-full max-w-[96rem] flex-col gap-1 px-4 py-4 sm:px-6">
        <div className="px-4 py-2">
          <ProductSearch onNavigate={closeMobileNav} />
        </div>
        <Link
          href={localizePath('/')}
          onClick={closeMobileNav}
          className="flex items-center gap-3 px-4 py-3 text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] rounded-xl font-medium transition-colors"
        >
          <svg
            className="w-5 h-5 text-[var(--accent-rose)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          {t('header.home')}
        </Link>
        <Link
          href={localizePath('/shop')}
          onClick={closeMobileNav}
          className="flex items-center gap-3 px-4 py-3 text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] rounded-xl font-medium transition-colors"
        >
          <svg
            className="w-5 h-5 text-[var(--accent-rose)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          {t('header.shop')}
        </Link>
        <Link
          href={localizePath('/about')}
          onClick={closeMobileNav}
          className="flex items-center gap-3 px-4 py-3 text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] rounded-xl font-medium transition-colors"
        >
          <svg
            className="w-5 h-5 text-[var(--accent-rose)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t('header.about')}
        </Link>
        <Link
          href={localizePath('/contact')}
          onClick={closeMobileNav}
          className="flex items-center gap-3 px-4 py-3 text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] rounded-xl font-medium transition-colors"
        >
          <svg
            className="w-5 h-5 text-[var(--accent-rose)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          {t('header.contact')}
        </Link>
        {!isLoggedIn && (
          <div className="pt-2 border-t border-[var(--border-warm)] mt-2">
            <GradientButton
              onClick={() => {
                closeMobileNav()
                onLoginClick()
              }}
              size="lg"
              fullWidth
              className="text-sm"
            >
              {t('header.login')}
            </GradientButton>
          </div>
        )}
      </nav>
    </div>
  )
}

export default MobileNav
