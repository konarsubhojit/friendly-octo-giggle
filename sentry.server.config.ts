import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
    sampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 1.0,
    beforeSend(event, hint) {
      const original = hint?.originalException
      // Defense-in-depth: instrumentation.ts already converts _ErrorEvent to a
      // normal Error at the uncaughtException level, but Sentry may capture
      // errors through other paths. Drop any that slip through.
      if (
        original &&
        typeof original === 'object' &&
        'type' in original &&
        (original as { type: string }).type === 'error' &&
        original.constructor?.name === '_ErrorEvent'
      ) {
        return null
      }
      return event
    },
  })
}
