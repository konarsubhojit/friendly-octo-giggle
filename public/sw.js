/**
 * Kiyon Store Service Worker
 * Provides offline shell caching for the app shell and static assets.
 * Product images are cached on first fetch (stale-while-revalidate).
 *
 * Routes excluded: /api/*, /admin/*, /auth/*, /monitoring
 */

const CACHE_VERSION = 'v1'
const SHELL_CACHE = `kiyon-shell-${CACHE_VERSION}`
const IMAGE_CACHE = `kiyon-images-${CACHE_VERSION}`
const ALL_CACHES = [SHELL_CACHE, IMAGE_CACHE]

/** App-shell pages to precache on install */
const SHELL_URLS = ['/', '/shop', '/cart', '/wishlist', '/offline']

/** Routes that should bypass the service worker entirely */
const BYPASS_PREFIXES = ['/api/', '/admin', '/auth', '/monitoring', '/_next/']

/** Maximum number of images to keep in the image cache */
const IMAGE_CACHE_LIMIT = 60

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(
          SHELL_URLS.filter((url) => url !== '/offline').concat(['/offline'])
        )
      )
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Let bypassed routes go straight to network
  if (BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return

  // Images: stale-while-revalidate with cache size limit
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request))
    return
  }

  // Navigation requests: network-first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request))
    return
  }

  // Static assets (_next/static, fonts): cache-first
  if (url.pathname.startsWith('/_next/static') || isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request))
    return
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isImageRequest(request) {
  const accept = request.headers.get('Accept') || ''
  return (
    accept.includes('image/') ||
    /\.(png|jpg|jpeg|webp|avif|gif|svg)(\?.*)?$/.test(
      new URL(request.url).pathname
    )
  )
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|eot)(\?.*)?$/.test(url.pathname)
}

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(request)

  // Serve from cache while revalidating in the background
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await trimCache(cache, IMAGE_CACHE_LIMIT)
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request)
    return response
  } catch {
    const cache = await caches.open(SHELL_CACHE)
    const cached = await cache.match(request)
    return cached || (await cache.match('/offline'))
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

/** Evict oldest entries when the cache exceeds `limit` entries. */
async function trimCache(cache, limit) {
  const keys = await cache.keys()
  if (keys.length > limit) {
    await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)))
  }
}
