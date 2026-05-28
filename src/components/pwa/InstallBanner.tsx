'use client'

import { useState, useEffect, useCallback } from 'react'

const DISMISSED_KEY = 'kiyon-install-banner-dismissed'
const DISMISSED_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < DISMISSED_DURATION_MS
  } catch {
    return false
  }
}

function persistDismissal() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  } catch {
    /* storage unavailable — ignore */
  }
}

function isStandaloneMode(): boolean {
  if (
    typeof window === 'undefined' ||
    !window.matchMedia ||
    typeof window.matchMedia !== 'function'
  )
    return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(
      'standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone
    )
  )
}

function checkIosSafari(): boolean {
  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  return isIos && isSafari
}

/**
 * Add-to-Home-Screen install banner.
 *
 * - Surfaces on Android Chrome via `beforeinstallprompt`.
 * - Shows a manual iOS Safari hint when running in Safari on iOS.
 * - Dismissal is persisted for 30 days via localStorage.
 *
 * Visibility and iOS-hint flag are computed via lazy useState initialisers so
 * we never call setState synchronously inside an effect body.
 */
export function InstallBanner() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)

  // Detect iOS Safari once at client mount (lazy initialiser, never re-runs)
  const [isIosSafari] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return checkIosSafari()
  })

  // iOS: show immediately if the user hasn't dismissed and isn't in standalone
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return !isDismissed() && !isStandaloneMode() && checkIosSafari()
  })

  // Android / Desktop Chrome: listen for beforeinstallprompt
  useEffect(() => {
    if (isDismissed() || isStandaloneMode()) return

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setVisible(false)
    setPromptEvent(null)
  }, [promptEvent])

  const handleDismiss = useCallback(() => {
    persistDismissal()
    setVisible(false)
  }, [])

  if (!visible) return null

  // Show the manual iOS tip when no native prompt is available
  const showIosTip = isIosSafari && !promptEvent

  return (
    <div
      role="banner"
      aria-label="Install Kiyon Store app"
      className="fixed bottom-0 left-0 right-0 z-[60] md:bottom-4 md:left-4 md:right-auto md:max-w-sm animate-fade-in"
    >
      <div className="m-2 md:m-0 rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/95 backdrop-blur-lg shadow-warm p-4 flex items-start gap-3">
        {/* Store icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="Kiyon Store"
          className="w-12 h-12 rounded-xl flex-shrink-0 object-cover"
          width={48}
          height={48}
        />

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-[var(--foreground)]">
            Install Kiyon Store
          </p>

          {showIosTip ? (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-snug">
              Tap{' '}
              <span className="inline-block font-bold" aria-label="Share icon">
                ↑
              </span>{' '}
              then &ldquo;Add to Home Screen&rdquo; to install.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-snug">
              Add to your home screen for quick access and offline browsing.
            </p>
          )}

          {promptEvent && (
            <button
              onClick={handleInstall}
              className="mt-2 min-tap px-4 py-1.5 rounded-lg bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white text-xs font-bold transition-all hover:opacity-90 focus-warm"
            >
              Install
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install banner"
          className="flex-shrink-0 min-tap rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-blush)] transition-colors"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
