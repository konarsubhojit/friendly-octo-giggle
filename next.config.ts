import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import createBundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  // india-pincode reads data/pincodes.json.gz at runtime via fs —
  // keep it out of the Turbopack bundle so the data file is resolvable.
  serverExternalPackages: ['india-pincode'],
  // Typed routes: internal `href`/`redirect`/`router` targets are checked
  // against the real route tree, so a mistyped route is a compile error rather
  // than a production 404. Stable and top-level in Next.js 16.3 —
  // `experimental.typedRoutes` is deprecated. Route props are declared as
  // `Route` (imported from `next`); an `as Route` cast is not the remedy for a
  // type error here, a corrected route string is.
  typedRoutes: true,
  // React Compiler: client components are memoized automatically, so
  // re-render correctness no longer depends on hand-placed `useMemo` /
  // `useCallback` dependency arrays. Top-level and stable in Next.js 16.3.
  // Requires `babel-plugin-react-compiler` (a devDependency); without it the
  // build aborts with an explicit resolution error rather than silently
  // shipping unoptimized output, which is what spec 015 FR-001 asks for.
  // Cost is build time only: the compile step goes from ~0.5 s to ~10 s.
  reactCompiler: true,
  // Cache Components: the public shell is prerendered and per-request regions
  // stream into Suspense holes. Incompatible with `export const dynamic` /
  // `revalidate` / `runtime` segment configs, which is why none remain.
  cacheComponents: true,
  // Named `cacheLife` profiles for every `"use cache"` scope in the app.
  // Values are anchored to the matching `CACHE_TTL` entries in src/lib/cache.ts
  // so the Cache Components layer and the Redis layer cannot disagree.
  cacheLife: {
    // Catalog listings and bestsellers (CACHE_TTL.PRODUCTS_LIST = 600).
    catalog: { stale: 60, revalidate: 300, expire: 3600 },
    // Product detail (CACHE_TTL.PRODUCT_DETAIL = 900).
    product: { stale: 60, revalidate: 900, expire: 3600 },
    // Category taxonomy (CACHE_TTL.CATEGORIES_LIST = 3600).
    taxonomy: { stale: 300, revalidate: 3600, expire: 86400 },
  },
  images: {
    // A custom loader takes full ownership of image URL construction, so
    // Next.js forbids combining `loaderFile` with `remotePatterns`/`domains`
    // (it would throw at startup). The allow-list that `remotePatterns` used
    // to enforce (images.unsplash.com, the Vercel Blob storage subdomain,
    // Google's avatar CDN, plus our own R2 public bucket) now lives in the
    // Worker's `ALLOWED_HOSTNAMES` config (`workers/images/wrangler.toml`)
    // and is enforced by `workers/images/src/validation.ts` before any
    // origin fetch — see `src/lib/image-loader.ts` for the loader itself.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
  // `/` is an alias for the storefront listing. This is issued at the routing
  // layer as a real 308 rather than by a `redirect()` inside a page component:
  // under `cacheComponents: true` a render-time redirect on an otherwise
  // static route prerenders an empty shell and expresses the redirect only in
  // the RSC payload, so a cold document load renders a blank page instead of
  // navigating. A config redirect never reaches the renderer.
  async redirects() {
    return [
      {
        source: '/',
        destination: '/shop',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, immutable',
          },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(
  withSentryConfig(nextConfig, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    // Sourced from the Vercel ↔ Sentry integration env vars
    // (SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN). Falls back to the
    // historical values so local builds without the integration keep working.
    org: process.env.SENTRY_ORG ?? 'kiyon',

    project: process.env.SENTRY_PROJECT ?? 'javascript-nextjs',

    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,
    sourcemaps: {
      // Work around preview build ENOENT for middleware.js.nft.json after uploads.
      disable:
        process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview',
    },

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    webpack: {
      // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      automaticVercelMonitors: true,

      // Tree-shaking options for reducing bundle size
      treeshake: {
        // Automatically tree-shake Sentry logger statements to reduce bundle size
        removeDebugLogging: true,
      },
    },
  })
)
