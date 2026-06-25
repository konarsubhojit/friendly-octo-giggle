import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { Nunito, Playfair_Display } from 'next/font/google'
import '../globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import StoreProvider from '@/components/providers/StoreProvider'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AppEnhancements } from '@/components/pwa/AppEnhancements'
import { LocaleProvider } from '@/contexts/LocaleContext'
import {
  SUPPORTED_LOCALES,
  getLocaleDirection,
  isSupportedLocale,
} from '@/lib/i18n/config'
import { getMessage } from '@/lib/i18n/messages'
import { STORE_NAME, STORE_SHORT_NAME } from '@/lib/constants/store'

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
  title: STORE_NAME,
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

// Pre-render both supported locales so `/en` and `/es` are eligible for
// SSG/ISR instead of the dynamic-on-demand path the prior root layout forced.
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

// Any locale outside SUPPORTED_LOCALES should 404 instead of silently
// resolving to the default locale.
export const dynamicParams = false

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale: rawLocale } = await params
  if (!isSupportedLocale(rawLocale)) {
    notFound()
  }
  const locale = rawLocale
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
          {children}
          <AppEnhancements />
        </AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
