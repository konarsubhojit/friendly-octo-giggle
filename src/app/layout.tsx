import type { Metadata, Viewport } from 'next'
import { Nunito, Playfair_Display } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import StoreProvider from '@/components/providers/StoreProvider'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import HeaderWrapper from '@/components/layout/HeaderWrapper'
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'
import { InstallBanner } from '@/components/pwa/InstallBanner'

type NoncedTelemetryComponent = React.ComponentType<{
  readonly nonce?: string
}>
// Vercel telemetry libraries support forwarding `nonce` at runtime for injected scripts.
const AnalyticsWithNonce = Analytics as NoncedTelemetryComponent
const SpeedInsightsWithNonce = SpeedInsights as NoncedTelemetryComponent

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
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kiyon',
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
  const nonce = (await headers()).get('x-nonce') || undefined

  return (
    <html
      lang="en"
      className={`${nunito.className} ${playfairDisplay.variable}`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        <AppProviders>
          <HeaderWrapper />
          <div className="relative">{children}</div>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--surface)',
                color: 'var(--foreground)',
                border: '1px solid var(--border-warm)',
                borderRadius: '16px',
              },
            }}
          />
          <InstallBanner />
        </AppProviders>
        <ServiceWorkerRegistration />
        <AnalyticsWithNonce nonce={nonce} />
        <SpeedInsightsWithNonce nonce={nonce} />
      </body>
    </html>
  )
}
