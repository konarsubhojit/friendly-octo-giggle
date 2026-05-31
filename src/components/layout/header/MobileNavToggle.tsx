'use client'

import { useLocale } from '@/contexts/LocaleContext'

export interface MobileNavToggleProps {
  readonly mobileNavOpen: boolean
  readonly onToggle: () => void
}

export function MobileNavToggle({
  mobileNavOpen,
  onToggle,
}: MobileNavToggleProps) {
  const { t } = useLocale()
  return (
    <button
      id="mobile-nav-toggle"
      onClick={onToggle}
      className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors"
      aria-label={mobileNavOpen ? t('header.closeMenu') : t('header.openMenu')}
      aria-expanded={mobileNavOpen}
      aria-haspopup="menu"
      aria-controls="mobile-nav-drawer"
    >
      {mobileNavOpen ? (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      )}
    </button>
  )
}

export default MobileNavToggle
