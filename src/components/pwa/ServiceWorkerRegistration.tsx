'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker (`/sw.js`) on the client side.
 * Renders nothing — purely a side-effect component placed once in the root layout.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new SW is ready — reload to activate (optional: show a toast)
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      } catch {
        // SW registration failures are non-critical
      }
    }

    // Defer registration until after page load for better LCP
    if (document.readyState === 'complete') {
      void register()
    } else {
      window.addEventListener('load', () => void register(), { once: true })
    }
  }, [])

  return null
}
