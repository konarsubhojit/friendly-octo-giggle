// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const isProd = process.env.NODE_ENV === 'production'

Sentry.init({
  // Vercel's Sentry integration provisions NEXT_PUBLIC_SENTRY_DSN; fall back
  // to SENTRY_DSN for manual/local setups.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
  environment: isProd ? 'production' : 'development',
  tracesSampleRate: isProd ? 0.1 : 1,
  enableLogs: true,
  sendDefaultPii: true,
})
