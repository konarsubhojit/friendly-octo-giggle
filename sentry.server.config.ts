import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
    sampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 1.0,
  })
}
