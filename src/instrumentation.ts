import * as Sentry from '@sentry/nextjs'

export const onRequestError = Sentry.captureRequestError

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
    const { patchErrorEvent } = await import('@/lib/patch-error-event')
    patchErrorEvent()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
