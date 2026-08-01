/**
 * Browser-side wait for a checkout request to settle.
 *
 * Replaces the completion poll: the page opens one connection to
 * `GET /api/checkout/{id}/stream` and is pushed the terminal status, instead of
 * asking for it on a timer and spending rate-limit budget on every ask.
 *
 * Reconnecting is expected rather than exceptional — the server closes each
 * connection before the platform's request ceiling — so a stream that ends
 * without a settlement is reopened, and only the deadline ends the wait.
 */

import type { CheckoutRequestStatusResponse } from '@/lib/types'

/** Longest the browser waits for a settlement before giving up. */
export const CHECKOUT_STREAM_DEADLINE_MS = 180_000

/** Pause before reopening a connection that failed rather than ended. */
export const CHECKOUT_STREAM_RECONNECT_DELAY_MS = 1_000

export const CHECKOUT_STREAM_TIMEOUT_MESSAGE =
  'Checkout is taking longer than expected. Please check your orders shortly.'

/** Raised when a checkout request settles as `FAILED`. */
export class CheckoutFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutFailedError'
  }
}

/** Raised when the deadline passes with the request still unsettled. */
export class CheckoutTimeoutError extends Error {
  constructor() {
    super(CHECKOUT_STREAM_TIMEOUT_MESSAGE)
    this.name = 'CheckoutTimeoutError'
  }
}

const isTerminalStatus = (status: string): boolean =>
  status === 'COMPLETED' || status === 'FAILED'

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

/**
 * A frame that does not parse, or does not look like a status, is skipped
 * rather than failing the wait: the backstop re-read behind the stream sends
 * the same status again moments later.
 */
const toStatus = (payload: string): CheckoutRequestStatusResponse | null => {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as CheckoutRequestStatusResponse).status === 'string'
    ) {
      return parsed as CheckoutRequestStatusResponse
    }
  } catch {
    // Fall through to the null below.
  }
  return null
}

/**
 * Split complete SSE frames out of the buffer.
 *
 * Returns the trailing partial frame so the caller can prepend it to the next
 * chunk — a status payload can be split across TCP reads. Comment lines (the
 * heartbeat) carry no `data:` and are dropped here.
 */
export const parseStatusFrames = (
  buffered: string
): {
  readonly statuses: readonly CheckoutRequestStatusResponse[]
  readonly rest: string
} => {
  const statuses: CheckoutRequestStatusResponse[] = []
  let rest = buffered

  for (
    let separator = rest.indexOf('\n\n');
    separator !== -1;
    separator = rest.indexOf('\n\n')
  ) {
    const frame = rest.slice(0, separator)
    rest = rest.slice(separator + 2)

    const payload = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('')

    if (!payload) continue

    const status = toStatus(payload)
    if (status) statuses.push(status)
  }

  return { statuses, rest }
}

/**
 * Read one connection to completion.
 *
 * @returns the terminal status, or `null` when the stream ended without one.
 */
const readUntilSettled = async (
  body: ReadableStream<Uint8Array>,
  onProgress?: (status: CheckoutRequestStatusResponse) => void
): Promise<CheckoutRequestStatusResponse | null> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return null

      buffered += decoder.decode(value, { stream: true })

      const { statuses, rest } = parseStatusFrames(buffered)
      buffered = rest

      for (const status of statuses) {
        if (isTerminalStatus(status.status)) return status
        onProgress?.(status)
      }
    }
  } finally {
    // Tears the connection down as soon as the wait is over instead of leaving
    // it to be collected.
    reader.cancel().catch(() => undefined)
  }
}

/**
 * Wait for a checkout request to reach a terminal state.
 *
 * @throws CheckoutFailedError when the request settles as `FAILED`.
 * @throws CheckoutTimeoutError when the deadline passes first.
 */
export const awaitCheckoutSettlement = async ({
  checkoutRequestId,
  onProgress,
  deadlineMs = CHECKOUT_STREAM_DEADLINE_MS,
}: {
  checkoutRequestId: string
  onProgress?: (status: CheckoutRequestStatusResponse) => void
  deadlineMs?: number
}): Promise<CheckoutRequestStatusResponse> => {
  const expiresAt = Date.now() + deadlineMs
  const controller = new AbortController()

  try {
    while (Date.now() < expiresAt) {
      let response: Response
      try {
        response = await fetch(`/api/checkout/${checkoutRequestId}/stream`, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        })
      } catch {
        // A dropped connection is routine on mobile networks, and says nothing
        // about the order — reconnect until the deadline.
        await sleep(CHECKOUT_STREAM_RECONNECT_DELAY_MS)
        continue
      }

      if (!response.ok || !response.body) {
        throw new Error(
          response.status === 404
            ? 'Checkout request not found'
            : 'Unable to follow checkout progress'
        )
      }

      let settled: CheckoutRequestStatusResponse | null
      try {
        settled = await readUntilSettled(response.body, onProgress)
      } catch {
        await sleep(CHECKOUT_STREAM_RECONNECT_DELAY_MS)
        continue
      }

      // The stream only ends early when the server's connection window
      // closes, so reopening immediately would risk a hot loop if it ever
      // ended for another reason.
      if (!settled) {
        await sleep(CHECKOUT_STREAM_RECONNECT_DELAY_MS)
        continue
      }

      if (settled.status === 'FAILED') {
        throw new CheckoutFailedError(settled.error ?? 'Checkout failed')
      }

      return settled
    }
  } finally {
    controller.abort()
  }

  throw new CheckoutTimeoutError()
}
