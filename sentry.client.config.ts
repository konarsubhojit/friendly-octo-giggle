import * as Sentry from '@sentry/nextjs'

// NOTE: The active client-side Sentry initialization lives in
// `src/instrumentation-client.ts` (Next.js 15+ convention). This file is kept
// for backwards compatibility with tooling that still expects it.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
    sampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 1.0,
  })
}
