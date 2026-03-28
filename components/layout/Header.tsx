"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import CartIcon from "@/components/layout/CartIcon";
import LoginModal from "@/components/auth/LoginModal";
import { GradientButton } from "@/components/ui/GradientButton";
import { FlowerAccent } from "@/components/ui/DecorativeElements";
import ProductSearch from "@/components/ui/ProductSearch";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface UserMenuUser {
  readonly name?: string | null;
  readonly email?: string | null;
  readonly image?: string | null;
  readonly role?: string;
}

interface UserMenuProps {
  readonly user: UserMenuUser;
  readonly menuOpen: boolean;
  readonly setMenuOpen: (open: boolean) => void;
  readonly menuRef: React.RefObject<HTMLDivElement | null>;
}

function UserMenu({ user, menuOpen, setMenuOpen, menuRef }: UserMenuProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setMenuOpen(false);
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="User menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
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
            {user.name?.[0]?.toUpperCase() || "U"}
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
            href="/account"
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
            My Account
          </Link>
          <Link
            href="/orders"
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
            My Orders
          </Link>
          <Link
            href="/wishlist"
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
            My Wishlist
          </Link>
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
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
              Admin Dashboard
            </Link>
          )}
          <div className="border-t border-[var(--border-warm)] mt-1 pt-1">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50/50 transition-colors rounded-lg mx-1 disabled:opacity-60 disabled:cursor-not-allowed"
              role="menuitem"
            >
              {signingOut ? (
                <LoadingSpinner size="h-4 w-4" color="text-red-500" label="Signing out…" />
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
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MobileNavProps {
  readonly isLoggedIn: boolean;
  readonly closeMobileNav: () => void;
  readonly onLoginClick: () => void;
}

function MobileNav({
  isLoggedIn,
  closeMobileNav,
  onLoginClick,
}: MobileNavProps) {
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
          href="/"
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
          Home
        </Link>
        <Link
          href="/shop"
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
          Shop
        </Link>
        <Link
          href="/about"
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
          About
        </Link>
        <Link
          href="/contact"
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
          Contact
        </Link>
        {!isLoggedIn && (
          <div className="pt-2 border-t border-[var(--border-warm)] mt-2">
            <GradientButton
              onClick={() => {
                closeMobileNav();
                onLoginClick();
              }}
              size="lg"
              fullWidth
              className="text-sm"
            >
              Login
            </GradientButton>
          </div>
        )}
      </nav>
    </div>
  );
}

export default function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile nav when route changes (click on link)
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--background)]/85 backdrop-blur-lg border-b border-[var(--border-warm)]/40 shadow-warm">
        <div className="mx-auto w-full max-w-[96rem] px-4 py-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="group flex min-w-0 items-center gap-1.5 text-xl font-bold transition-all duration-300 sm:text-2xl"
            >
              <FlowerAccent className="w-7 h-7 group-hover:animate-wiggle" />
              <span className="font-display truncate bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-warm)] bg-clip-text text-transparent">
                The Kiyon Store
              </span>
            </Link>

            <nav className="hidden items-center gap-4 md:flex xl:gap-8">
              <Link
                href="/"
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                Home
              </Link>
              <Link
                href="/shop"
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                Shop
              </Link>
              <Link
                href="/about"
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                About
              </Link>
              <Link
                href="/contact"
                className="text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--accent-blush)]/50"
              >
                Contact
              </Link>
            </nav>

            <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
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
                  Login
                </GradientButton>
              )}

              {/* Mobile hamburger button */}
              <button
                id="mobile-nav-toggle"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors"
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
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
  );
}
