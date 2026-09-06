import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import localFont from 'next/font/local'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import StoreProvider from '@/components/providers/StoreProvider'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AppEnhancements } from '@/components/pwa/AppEnhancements'
import { STORE_NAME, STORE_SHORT_NAME } from '@/lib/constants/store'

/**
 * Client provider tree.
 *
 * `makeStore()` calls `configureStore`, whose action-id generation uses
 * `Math.random()`. Under Cache Components that is a sync-IO source that aborts
 * the prerender of every page unless a `Suspense` boundary sits above it, so
 * the root layout mounts this behind one.
 */
function AppProviders({ children }: { readonly children: React.ReactNode }) {
  return (
    <StoreProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <SessionProvider>{children}</SessionProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </StoreProvider>
  )
}

// Self-hosted (rather than `next/font/google`) so the production build never
// depends on fetching Google Fonts at build time. Turbopack's Google Fonts
// loader has a known intermittent failure mode
// (Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font',
// see https://github.com/vercel/next.js/issues/97344) that has aborted Vercel
// builds for this app. Both files are the latin-subset variable fonts served
// by Google Fonts, so weight/style coverage is unchanged.
const nunito = localFont({
  src: './fonts/nunito-latin.woff2',
  weight: '400 800',
  style: 'normal',
  display: 'swap',
})

const playfairDisplay = localFont({
  src: [
    {
      path: './fonts/playfair-display-latin.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: './fonts/playfair-display-latin-italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
  ],
  display: 'swap',
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: STORE_NAME,
  description:
    'Handmade crochet flowers, bags, keychains, and accessories — crafted with love, delivered to your door.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: STORE_SHORT_NAME,
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#e89588',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.className} ${playfairDisplay.variable}`}
    >
      <head>
        <link
          rel="preconnect"
          href="https://va.vercel-scripts.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
        <link
          rel="preconnect"
          href="https://blob.vercel-storage.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://blob.vercel-storage.com" />
      </head>
      <body className="antialiased">
        <a
          href="#main-content"
          className="skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:font-semibold focus:text-[var(--foreground)]"
        >
          Skip to main content
        </a>
        <Suspense>
          <AppProviders>
            {children}
            <AppEnhancements />
          </AppProviders>
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
