'use client'

import dynamic from 'next/dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from '@/components/ui/LocaleLink'
import { useSession } from 'next-auth/react'
import CartIcon from '@/components/layout/CartIcon'
import { GradientButton } from '@/components/ui/GradientButton'
import { FlowerAccent } from '@/components/ui/DecorativeElements'
import { useLocale } from '@/contexts/LocaleContext'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { UserMenu } from './header/UserMenu'
import { MobileNav } from './header/MobileNav'
import { MobileNavToggle } from './header/MobileNavToggle'

const LoginModal = dynamic(
  () => import('@/features/auth/components/LoginModal'),
  { ssr: false }
)
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

export default function Header() {
  const { t, localizePath } = useLocale()
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile nav when route changes (click on link)
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (!menuOpen && !mobileNavOpen) return
      setMenuOpen(false)
      setMobileNavOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [menuOpen, mobileNavOpen])

  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--background)]/85 backdrop-blur-lg border-b border-[var(--border-warm)]/40 shadow-warm">
        <div className="mx-auto w-full max-w-[96rem] px-4 py-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={localizePath('/')}
              className="group flex min-w-0 items-center gap-1.5 text-xl font-bold transition-all duration-300 sm:text-2xl"
            >
              <FlowerAccent className="w-7 h-7 group-hover:animate-wiggle" />
              <span className="font-display truncate bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-warm)] bg-clip-text text-transparent">
                {t('common.storeName')}
              </span>
            </Link>

            <nav className="hidden items-center gap-4 md:flex xl:gap-8">
              <Link
                href={localizePath('/')}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                {t('header.home')}
              </Link>
              <Link
                href={localizePath('/shop')}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                {t('header.shop')}
              </Link>
              <Link
                href={localizePath('/about')}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                {t('header.about')}
              </Link>
              <Link
                href={localizePath('/contact')}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                {t('header.contact')}
              </Link>
            </nav>

            <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
              <LanguageSwitcher />
              <div className="hidden sm:block">
                <ProductSearch />
              </div>
              <CartIcon />

              {session?.user ? (
                <UserMenu
                  user={session.user}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  menuRef={menuRef}
                />
              ) : (
                <GradientButton
                  onClick={() => setLoginModalOpen(true)}
                  size="sm"
                  className="hidden sm:block"
                >
                  {t('header.login')}
                </GradientButton>
              )}

              <MobileNavToggle
                mobileNavOpen={mobileNavOpen}
                onToggle={() => setMobileNavOpen(!mobileNavOpen)}
              />
            </div>
          </div>
        </div>

        {mobileNavOpen && (
          <MobileNav
            isLoggedIn={!!session?.user}
            closeMobileNav={closeMobileNav}
            onLoginClick={() => setLoginModalOpen(true)}
          />
        )}
      </header>
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
    </>
  )
}
