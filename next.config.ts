import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  // india-pincode reads data/pincodes.json.gz at runtime via fs —
  // keep it out of the Turbopack bundle so the data file is resolvable.
  serverExternalPackages: ['india-pincode'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // ** matches multi-level subdomains in Next.js remotePatterns
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
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
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-eval only in dev (React dev tools / HMR); stripped in production
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
              "style-src 'self' 'unsafe-inline'",
              // CSP * already matches multi-level subdomains (unlike Next.js remotePatterns)
              "img-src 'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com https://lh3.googleusercontent.com",
              "font-src 'self'",
              "connect-src 'self' https://va.vercel-scripts.com https://accounts.google.com https://login.microsoftonline.com https://graph.microsoft.com",
              "frame-src 'self' https://accounts.google.com https://login.microsoftonline.com",
            ].join('; '),
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

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
