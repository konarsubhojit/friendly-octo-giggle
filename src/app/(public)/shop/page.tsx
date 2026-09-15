import { redirect } from 'next/navigation'

/**
 * `/shop` is a legacy alias for the storefront listing, which now renders
 * directly at `/` (see `src/app/(public)/page.tsx`).
 *
 * The redirect users actually hit is the 308 declared in `next.config.ts`,
 * issued at the routing layer before any render. This route is retained so
 * `/shop` stays a real entry in the route tree — external bookmarks and any
 * stray `href="/shop"` type-check against it under `typedRoutes` — and as a
 * defence-in-depth fallback.
 *
 * Do not make this the primary redirect. Under `cacheComponents: true` a
 * render-time `redirect()` on an otherwise static route prerenders an empty
 * shell and expresses the redirect only in the RSC payload, so a cold document
 * load renders a blank page instead of navigating.
 */
export default function ShopRedirect() {
  redirect('/')
}
