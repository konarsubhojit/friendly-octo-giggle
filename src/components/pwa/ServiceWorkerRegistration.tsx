'use client'

import { useEffect } from 'react'

const handleStateChange = (newWorker: ServiceWorker) => {
  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
    newWorker.postMessage({ type: 'SKIP_WAITING' })
  }
}

const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
  const newWorker = registration.installing
  if (!newWorker) return
  newWorker.addEventListener('statechange', () => handleStateChange(newWorker))
}

const register = async () => {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    registration.addEventListener('updatefound', () =>
      handleUpdateFound(registration)
    )
  } catch {
    // SW registration failures are non-critical
  }
}

/**
 * Registers the service worker (`/sw.js`) on the client side.
 * Renders nothing — purely a side-effect component placed once in the root layout.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (globalThis.window === undefined || !('serviceWorker' in navigator))
      return

    const handleLoad = () => void register()

    // Defer registration until after page load for better LCP
    if (document.readyState === 'complete') {
      void register()
    } else {
      window.addEventListener('load', handleLoad, { once: true })
    }

    return () => window.removeEventListener('load', handleLoad)
  }, [])

  return null
}
