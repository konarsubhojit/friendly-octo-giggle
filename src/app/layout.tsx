import type { Metadata, Viewport } from 'next'
import { Nunito, Playfair_Display } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import StoreProvider from '@/components/providers/StoreProvider'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import HeaderWrapper from '@/components/layout/HeaderWrapper'
import { AppEnhancements } from '@/components/pwa/AppEnhancements'
import { LocaleProvider } from '@/contexts/LocaleContext'
import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  isSupportedLocale,
} from '@/lib/i18n/config'
import { getMessage } from '@/lib/i18n/messages'

function AppProviders({
  children,
  locale,
}: {
  readonly children: React.ReactNode
  readonly locale: 'en' | 'es'
}) {
  return (
    <StoreProvider>
      <ThemeProvider>
        <LocaleProvider locale={locale}>
          <CurrencyProvider>
            <SessionProvider>{children}</SessionProvider>
          </CurrencyProvider>
        </LocaleProvider>
      </ThemeProvider>
    </StoreProvider>
  )
}

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'The Kiyon Store',
  description:
    'Handmade crochet flowers, bags, keychains, and accessories — crafted with love, delivered to your door.',
  alternates: {
    languages: {
      en: '/en',
      es: '/es',
      'x-default': '/en',
    },
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kiyon',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Only `x-locale` (set by middleware.ts) is needed here. The previous
  // `x-nonce` lookup was dead code: middleware.ts does not set it, so
  // forwarding `nonce` to <Analytics>/<SpeedInsights> never had an effect.
  const requestHeaders = await headers()
  const localeHeader = requestHeaders.get('x-locale') || DEFAULT_LOCALE
  const locale = isSupportedLocale(localeHeader) ? localeHeader : DEFAULT_LOCALE
  const dir = getLocaleDirection(locale)

  return (
    <html
      lang={locale}
      dir={dir}
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
          {getMessage(locale, 'common.skipToContent')}
        </a>
        <AppProviders locale={locale}>
          <HeaderWrapper />
          <main id="main-content" className="relative">
            {children}
          </main>
          <AppEnhancements />
        </AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
