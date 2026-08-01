/**
 * Server-Sent Events bridge for checkout settlement.
 *
 * The browser used to poll `GET /api/checkout/{id}` on a backoff, which made
 * the customer wait for the next tick rather than for the order, and spent
 * rate-limit budget on a bucket shared with the rest of the API. Here the
 * request is held open instead and the terminal status is pushed the moment a
 * checkout run announces it on its Realtime channel.
 *
 * Realtime is an accelerator, not the contract: a status re-read runs on a
 * timer behind the subscription, so a dropped message — or an environment with
 * no Inngest keys at all — still settles the wait, just less promptly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withLogging } from '@/lib/api-middleware'
import {
  getCheckoutRequestStatusForUser,
  isCheckoutRequestError,
} from '@/features/cart/services/checkout-service'
import {
  isTerminalCheckoutStatus,
  subscribeToCheckoutStatus,
  type CheckoutStatusSubscription,
} from '@/lib/inngest/realtime'
import { logError } from '@/lib/logger'
import type { CheckoutRequestStatusResponse } from '@/lib/types'

/**
 * Ceiling for one connection.
 *
 * Serverless platforms kill a request at their own limit with no chance to
 * close the stream cleanly, so the window below ends it first.
 */
export const maxDuration = 60

/** How long one connection is held before the browser reconnects. */
export const CHECKOUT_STREAM_WINDOW_MS = 50_000

/**
 * Cadence of the status re-read when Realtime is pushing.
 *
 * Only a backstop for a dropped message, so it stays slow enough that the
 * database load of a wait is a fraction of what the old client poll cost.
 */
export const CHECKOUT_STREAM_BACKSTOP_INTERVAL_MS = 15_000

/** Cadence of the status re-read when Realtime is unavailable. */
export const CHECKOUT_STREAM_FALLBACK_INTERVAL_MS = 3_000

const encoder = new TextEncoder()

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Buffering proxies would hold the settlement back and defeat the push.
  'X-Accel-Buffering': 'no',
} as const

const encodeStatusEvent = (status: CheckoutRequestStatusResponse): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(status)}\n\n`)

/** SSE comment: keeps intermediaries from reaping an idle connection. */
const HEARTBEAT = encoder.encode(': ping\n\n')

const buildStatusStream = ({
  checkoutRequestId,
  userId,
  initial,
}: {
  checkoutRequestId: string
  userId: string
  initial: CheckoutRequestStatusResponse
}): ReadableStream<Uint8Array> => {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  let subscription: CheckoutStatusSubscription | null = null
  let recheckTimer: ReturnType<typeof setInterval> | undefined
  let windowTimer: ReturnType<typeof setTimeout> | undefined
  let lastStatus = ''

  const release = () => {
    clearInterval(recheckTimer)
    clearTimeout(windowTimer)
    subscription?.close()
    subscription = null
  }

  const finish = () => {
    if (!controller) return
    const open = controller
    controller = null
    release()
    open.close()
  }

  /** Emit a status, and end the stream once it is terminal. */
  const emit = (status: CheckoutRequestStatusResponse) => {
    if (!controller || status.status === lastStatus) return
    lastStatus = status.status
    controller.enqueue(encodeStatusEvent(status))
    if (isTerminalCheckoutStatus(status.status)) finish()
  }

  const recheck = async () => {
    if (!controller) return
    try {
      emit(await getCheckoutRequestStatusForUser({ checkoutRequestId, userId }))
      controller?.enqueue(HEARTBEAT)
    } catch (error) {
      // The row was readable a moment ago, so a failure here is the database
      // rather than the request. Ending the stream lets the browser reconnect
      // instead of sitting on a connection that has stopped reporting.
      logError({
        error,
        context: 'checkout_stream_recheck_failed',
        additionalInfo: { checkoutRequestId },
      })
      finish()
    }
  }

  return new ReadableStream<Uint8Array>({
    async start(streamController) {
      controller = streamController

      emit(initial)
      if (!controller) return

      subscription = await subscribeToCheckoutStatus({
        checkoutRequestId,
        onMessage: emit,
      })

      // The subscription may have arrived after a re-read already settled the
      // request; dropping it here keeps a closed stream from holding a socket.
      if (!controller) {
        release()
        return
      }

      // A settlement announced while the subscription was still connecting is
      // not replayed to it. Without this read the customer would wait for the
      // next backstop tick for an order that already exists — the exact stall
      // this route exists to remove.
      await recheck()
      if (!controller) return

      recheckTimer = setInterval(
        recheck,
        subscription
          ? CHECKOUT_STREAM_BACKSTOP_INTERVAL_MS
          : CHECKOUT_STREAM_FALLBACK_INTERVAL_MS
      )
      windowTimer = setTimeout(finish, CHECKOUT_STREAM_WINDOW_MS)
    },
    cancel() {
      controller = null
      release()
    },
  })
}

const handleGet = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    // Doubles as the ownership check: a request belonging to another customer
    // is a 404 here, so no subscription is ever opened for it.
    const initial = await getCheckoutRequestStatusForUser({
      checkoutRequestId: id,
      userId,
    })

    return new Response(
      buildStatusStream({ checkoutRequestId: id, userId, initial }),
      { headers: SSE_HEADERS }
    )
  } catch (error) {
    if (isCheckoutRequestError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    logError({
      error,
      context: 'checkout_request_stream',
      additionalInfo: { path: request.nextUrl.pathname },
    })
    return NextResponse.json(
      { error: 'Failed to stream checkout request status' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(handleGet)
