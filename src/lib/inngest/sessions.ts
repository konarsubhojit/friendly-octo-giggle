/**
 * Typed builders for Inngest session metadata.
 *
 * Sessions group runs that belong to the same domain entity so the dashboard
 * can show a checkout, an order lifecycle, or a cart-recovery sequence as one
 * timeline instead of a set of unrelated runs.
 *
 * Everything goes through these builders for two reasons:
 *  - Session IDs render verbatim in the Inngest dashboard, so only opaque
 *    internal identifiers may become one. Routing every construction site
 *    through this module is what keeps an email address or a postal address
 *    from ever being used as a session ID.
 *  - Inngest silently drops session entries beyond the per-event cap, so the
 *    merge helper enforces the limit here rather than letting a fan-out site
 *    lose the session that mattered.
 */

import type { EventSessions } from 'inngest'

/**
 * Session keys used by this application.
 *
 * Deliberately high-cardinality: one ID per checkout, order, cart, or chat
 * thread. Low-cardinality labels (environment, user role) belong in Insights,
 * not here — they would collapse every run into a handful of huge sessions.
 */
export const SESSION_KEYS = {
  checkoutRequest: 'checkout_request_id',
  order: 'order_id',
  cart: 'cart_id',
  thread: 'thread_id',
} as const

export type SessionKey = (typeof SESSION_KEYS)[keyof typeof SESSION_KEYS]

/** Inngest rejects session IDs longer than 512 bytes. */
const MAX_SESSION_ID_BYTES = 512

/** Inngest keeps at most 5 session entries per event. */
export const MAX_SESSIONS_PER_EVENT = 5

const encoder = new TextEncoder()

/**
 * Whether a candidate value is usable as a session ID.
 *
 * Empty and oversized IDs are rejected rather than truncated: a truncated ID
 * would silently merge unrelated entities into one session, which is worse
 * than having no session at all.
 */
const isUsableSessionId = (value: string): boolean =>
  value.length > 0 && encoder.encode(value).length <= MAX_SESSION_ID_BYTES

const buildSession = (
  key: SessionKey,
  id: string | null | undefined
): EventSessions => {
  const trimmed = id?.trim() ?? ''
  return isUsableSessionId(trimmed) ? { [key]: trimmed } : {}
}

/** Session for a checkout request, spanning its whole processing pipeline. */
export const checkoutSession = (
  checkoutRequestId: string | null | undefined
): EventSessions => buildSession(SESSION_KEYS.checkoutRequest, checkoutRequestId)

/** Session for an order, spanning creation through status changes and refunds. */
export const orderSession = (
  orderId: string | null | undefined
): EventSessions => buildSession(SESSION_KEYS.order, orderId)

/** Session for a cart, spanning both abandoned-cart reminders and the scorer. */
export const cartSession = (cartId: string | null | undefined): EventSessions =>
  buildSession(SESSION_KEYS.cart, cartId)

/** Session for an AI chat thread, spanning every turn in the conversation. */
export const threadSession = (
  threadId: string | null | undefined
): EventSessions => buildSession(SESSION_KEYS.thread, threadId)

/**
 * Merge session fragments, keeping the first entry for a repeated key and
 * dropping anything past the per-event cap.
 *
 * Order is significant: callers list the most specific session first so that
 * when the cap trims the tail, the session that best identifies the run is the
 * one that survives.
 */
export const mergeSessions = (
  ...fragments: ReadonlyArray<EventSessions | undefined>
): EventSessions | undefined => {
  const merged: Record<string, string | number> = {}

  for (const fragment of fragments) {
    if (!fragment) continue
    for (const [key, value] of Object.entries(fragment)) {
      if (key in merged) continue
      if (Object.keys(merged).length >= MAX_SESSIONS_PER_EVENT) break
      merged[key] = value
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}
