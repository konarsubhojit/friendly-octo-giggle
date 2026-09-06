import { redirect } from 'next/navigation'

/**
 * `/` is an alias for `/shop`.
 *
 * The redirect users actually hit is the 308 declared in `next.config.ts`,
 * issued at the routing layer before any render. This route is retained so `/`
 * stays a real entry in the route tree — the many `href="/"` links across the
 * app type-check against it under `typedRoutes` — and as a defence-in-depth
 * fallback.
 *
 * Do not make this the primary redirect. Under `cacheComponents: true` a
 * render-time `redirect()` on an otherwise static route prerenders an empty
 * shell and expresses the redirect only in the RSC payload, so a cold document
 * load renders a blank page instead of navigating.
 */
export default function Home() {
  redirect('/shop')
}
