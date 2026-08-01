// Architecture note: Checkout uses API routes plus a durable Inngest function
// rather than server actions. The event gives durable delivery, per-step
// retries, and idempotency keyed on the checkout request id — critical for
// payment-adjacent workflows where exactly-once processing matters. See also
// features/orders/actions/orders.ts for the server action counterpart used
// for simpler order reads and search operations.

import { waitUntil } from '@vercel/functions'
import { db } from '@/lib/db'
import {
  createOrderForUser,
  isOrderRequestError,
} from '@/features/orders/services/order-service'
import {
  CHECKOUT_QUEUE_LAG_OPERATION,
  logBusinessEvent,
  logError,
  logPerformance,
} from '@/lib/logger'
import { formatStructuredAddress } from '@/lib/address-utils'
import type {
  CheckoutEnqueueResponse,
  CheckoutRequestStatusResponse,
  CheckoutRequestStatus,
} from '@/lib/types'
import {
  CheckoutQueueMessageSchema,
  SubmitCheckoutSchema,
  type SubmitCheckoutInput,
} from '@/features/cart/validations'
import { assertOwnership } from '@/lib/ownership'
import {
  ensurePaymentProviderConfigured,
  PaymentConfigurationError,
} from '@/lib/payments'
import {
  isPaymentProvider,
  requiresPaymentSignature,
} from '@/lib/payments/providers'
import { toShippingMethod } from '@/lib/shipping'
import { isInngestConfigured } from '@/lib/inngest/client'
import { publishWithTimeout } from '@/lib/inngest/dispatch'
import { publishCheckoutStatus } from '@/lib/inngest/realtime'
import { checkoutSession } from '@/lib/inngest/sessions'
import { checkoutRequestCreated } from '@/features/cart/inngest/events'
import type { CheckoutPaymentInput } from '@/lib/types'

export interface CheckoutSessionUser {
  readonly id: string
  readonly name?: string | null
  readonly email?: string | null
}

export interface AdminCheckoutRequestRecord {
  readonly id: string
  readonly userId: string
  readonly customerName: string
  readonly customerEmail: string
  readonly customerAddress: string
  readonly itemCount: number
  readonly status: CheckoutRequestStatus
  readonly errorMessage: string | null
  readonly orderId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

interface RecentCheckoutRequestFilters {
  readonly limit?: number
  readonly search?: string
  readonly status?: CheckoutRequestStatus
}

class CheckoutRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CheckoutRequestError'
    this.status = status
  }
}

export const isCheckoutRequestError = (
  error: unknown
): error is CheckoutRequestError => error instanceof CheckoutRequestError

const getNormalizedCheckoutInput = (
  body: unknown,
  user: CheckoutSessionUser
): SubmitCheckoutInput => {
  const rawBody =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {}

  const parseResult = SubmitCheckoutSchema.safeParse({
    customerName:
      typeof rawBody.customerName === 'string' && rawBody.customerName.trim()
        ? rawBody.customerName
        : (user.name ?? 'Customer'),
    customerEmail:
      typeof rawBody.customerEmail === 'string' && rawBody.customerEmail.trim()
        ? rawBody.customerEmail
        : (user.email ?? ''),
    addressLine1:
      typeof rawBody.addressLine1 === 'string' ? rawBody.addressLine1 : '',
    addressLine2:
      typeof rawBody.addressLine2 === 'string' ? rawBody.addressLine2 : '',
    addressLine3:
      typeof rawBody.addressLine3 === 'string' ? rawBody.addressLine3 : '',
    pinCode: typeof rawBody.pinCode === 'string' ? rawBody.pinCode : '',
    city: typeof rawBody.city === 'string' ? rawBody.city : '',
    state: typeof rawBody.state === 'string' ? rawBody.state : '',
    items: rawBody.items,
    couponCode:
      typeof rawBody.couponCode === 'string' && rawBody.couponCode.trim()
        ? rawBody.couponCode
        : undefined,
    shippingMethod: rawBody.shippingMethod,
    payment: rawBody.payment,
  })

  if (!parseResult.success) {
    throw new CheckoutRequestError(
      parseResult.error.issues[0]?.message ?? 'Invalid checkout request',
      400
    )
  }

  return parseResult.data
}

/**
 * Rebuild the payment reference persisted on a checkout request.
 *
 * Providers that sign their references (e.g. Razorpay) must have every field
 * present; offline providers such as Cash on Delivery only carry the provider,
 * and their references are generated during verification.
 */
const buildStoredPaymentReference = (checkoutRequest: {
  paymentProvider: string | null
  paymentOrderId: string | null
  paymentTransactionId: string | null
  paymentSignature: string | null
}): CheckoutPaymentInput | undefined => {
  const provider = checkoutRequest.paymentProvider
  if (!isPaymentProvider(provider)) return undefined

  const hasSignedReference =
    checkoutRequest.paymentOrderId &&
    checkoutRequest.paymentTransactionId &&
    checkoutRequest.paymentSignature

  if (requiresPaymentSignature(provider) && !hasSignedReference) {
    return undefined
  }

  return {
    provider,
    orderId: checkoutRequest.paymentOrderId ?? undefined,
    paymentId: checkoutRequest.paymentTransactionId ?? undefined,
    signature: checkoutRequest.paymentSignature ?? undefined,
  }
}

const buildCheckoutStatusResponse = (
  checkoutRequestId: string,
  status: CheckoutRequestStatus,
  orderId: string | null,
  error: string | null
): CheckoutRequestStatusResponse => ({
  checkoutRequestId,
  status,
  orderId,
  error,
})

const buildRetryExhaustedMessage = (
  deliveryCount: number,
  error: unknown
): string => {
  const reason =
    error instanceof Error ? error.message : 'Unknown consumer error'
  return `Automatic recovery stopped after ${deliveryCount} attempts: ${reason}`
}

/**
 * Write a checkout request's status and announce it when it is terminal.
 *
 * Every settlement in this service goes through here — the durable run, the
 * inline fallback, the payment webhook, the retry-exhaustion handler and the
 * status self-heal — so putting the Realtime announcement at this single seam
 * is what lets the payment page wait on a push instead of polling, whichever
 * path actually settles the request.
 *
 * The announcement is best-effort and cannot fail the write: the status row
 * stays the source of truth and `GET /api/checkout/{id}/stream` re-reads it on
 * a timer, so a lost message costs the customer a few seconds, never an order.
 */
const updateCheckoutRequestStatus = async (
  checkoutRequestId: string,
  status: CheckoutRequestStatus,
  errorMessage: string | null,
  orderId: string | null = null
) => {
  await db.checkoutRequests.updateStatus(
    checkoutRequestId,
    status,
    errorMessage
  )

  await publishCheckoutStatus({
    checkoutRequestId,
    status,
    orderId,
    error: status === 'FAILED' ? errorMessage : null,
  })
}

const findCheckoutRequestById = (checkoutRequestId: string) =>
  db.checkoutRequests.findById(checkoutRequestId)

const findCreatedOrderForCheckout = (checkoutRequestId: string) =>
  db.orders.findFirstByCheckoutRequestId(checkoutRequestId)

export const getRecentCheckoutRequests = async (
  filters: RecentCheckoutRequestFilters = {}
): Promise<AdminCheckoutRequestRecord[]> => {
  const { limit = 50, search, status } = filters
  const rows = await db.checkoutRequests.findRecentWithOrders({ limit })

  const normalizedSearch = search?.trim().toLowerCase() ?? ''

  return rows
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerAddress: row.customerAddress,
      itemCount: row.items.length,
      status: row.status,
      errorMessage: row.errorMessage,
      orderId: row.orderId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
    .filter((record) => {
      if (status && record.status !== status) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableValues = [
        record.id,
        record.userId,
        record.customerName,
        record.customerEmail,
        record.customerAddress,
        record.orderId ?? '',
        record.errorMessage ?? '',
      ]

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    })
    .slice(0, limit)
}

export const recoverCheckoutRequestAfterRetryExhaustion = async ({
  checkoutRequestId,
  deliveryCount,
  error,
}: {
  checkoutRequestId: string
  deliveryCount: number
  error: unknown
}): Promise<void> => {
  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId)

  if (existingOrder) {
    await updateCheckoutRequestStatus(
      checkoutRequestId,
      'COMPLETED',
      null,
      existingOrder.id
    )
    return
  }

  // A terminal failure already recorded the precise reason (declined payment,
  // out-of-stock item). Overwriting it with the generic retry-exhausted message
  // would hide that from the customer and from support.
  const checkoutRequest = await findCheckoutRequestById(checkoutRequestId)
  if (checkoutRequest?.status === 'FAILED') {
    return
  }

  const errorMessage = buildRetryExhaustedMessage(deliveryCount, error)
  await updateCheckoutRequestStatus(checkoutRequestId, 'FAILED', errorMessage)

  logBusinessEvent({
    event: 'checkout_request_retry_exhausted',
    details: {
      checkoutRequestId,
      deliveryCount,
      reason: errorMessage,
    },
    success: false,
  })
}

/**
 * Publish the checkout event, giving up on the wait after a fixed budget.
 *
 * This runs inside the request the customer is waiting on, and the Inngest SDK
 * retries a failed publish up to five times with no timeout of its own. Left
 * unbounded, a degraded Inngest API would hold the route open until the
 * platform kills it at `maxDuration`, so neither the queue fallback below nor
 * the caller's inline fallback would ever run and the request would be
 * stranded in `PENDING` with no orchestrator. `publishWithTimeout` owns that
 * budget for every producer in the app.
 *
 * The session key is attached here rather than in the function, because it has
 * to be on the *first* event for the whole downstream fan-out — confirmation
 * email, search index, cache invalidation — to appear under one
 * `checkout_request_id` in the dashboard.
 */
const publishCheckoutEvent = (checkoutRequestId: string): Promise<void> =>
  publishWithTimeout(
    checkoutRequestCreated.create(
      { checkoutRequestId },
      { meta: { sessions: checkoutSession(checkoutRequestId) } }
    )
  )

/**
 * Hand a checkout request to its durable orchestrator.
 *
 * Inngest is the single orchestrator: each pipeline step checkpoints
 * independently, so a retry resumes after the last completed step instead of
 * replaying payment verification.
 *
 * Throws when the event cannot be published, letting the caller fall back to
 * the inline last resort. That fallback is the only remaining safety net now
 * that the parallel Vercel Queue consumer is gone — two orchestrators writing
 * the same order row was the risk it traded against.
 */
const dispatchCheckoutProcessing = async ({
  checkoutRequestId,
  userId,
}: {
  checkoutRequestId: string
  userId: string
}): Promise<void> => {
  if (!isInngestConfigured()) {
    throw new Error(
      'Inngest is not configured; no durable orchestrator is available'
    )
  }

  try {
    await publishCheckoutEvent(checkoutRequestId)
  } catch (error) {
    logError({
      error,
      context: 'checkout_inngest_publish_failed',
      additionalInfo: { checkoutRequestId, userId },
    })
    throw error
  }
}

export const enqueueCheckoutForUser = async ({
  body,
  user,
}: {
  body: unknown
  user: CheckoutSessionUser
}): Promise<CheckoutEnqueueResponse> => {
  const normalized = getNormalizedCheckoutInput(body, user)
  if (normalized.payment) {
    try {
      ensurePaymentProviderConfigured(normalized.payment.provider)
    } catch (error) {
      if (error instanceof PaymentConfigurationError) {
        throw new CheckoutRequestError(error.message, error.status)
      }
      throw error
    }
  }

  // Only signature-based providers carry client-supplied references. Persisting
  // them for offline providers would let a caller point a Cash on Delivery
  // order at another provider's transaction id.
  const storedPayment =
    normalized.payment && requiresPaymentSignature(normalized.payment.provider)
      ? normalized.payment
      : undefined

  const checkoutRequest = await db.checkoutRequests.create({
    userId: user.id,
    customerName: normalized.customerName,
    customerEmail: normalized.customerEmail,
    customerAddress: formatStructuredAddress({
      customerAddress: '',
      addressLine1: normalized.addressLine1,
      addressLine2: normalized.addressLine2,
      addressLine3: normalized.addressLine3,
      pinCode: normalized.pinCode,
      city: normalized.city,
      state: normalized.state,
    }),
    addressLine1: normalized.addressLine1,
    addressLine2: normalized.addressLine2 || null,
    addressLine3: normalized.addressLine3 || null,
    pinCode: normalized.pinCode,
    city: normalized.city,
    state: normalized.state,
    items: normalized.items,
    couponCode: normalized.couponCode ?? null,
    shippingMethod: toShippingMethod(normalized.shippingMethod),
    paymentProvider: normalized.payment?.provider ?? null,
    paymentOrderId: storedPayment?.orderId ?? null,
    paymentTransactionId: storedPayment?.paymentId ?? null,
    paymentSignature: storedPayment?.signature ?? null,
    status: 'PENDING',
  })

  try {
    await dispatchCheckoutProcessing({
      checkoutRequestId: checkoutRequest.id,
      userId: user.id,
    })
  } catch (error) {
    logError({
      error,
      context: 'checkout_dispatch_failed_using_inline_fallback',
      additionalInfo: {
        checkoutRequestId: checkoutRequest.id,
        userId: user.id,
      },
    })
    waitUntil(processCheckoutRequestById(checkoutRequest.id))
  }

  logBusinessEvent({
    event: 'checkout_request_queued',
    details: {
      checkoutRequestId: checkoutRequest.id,
      userId: user.id,
      itemCount: normalized.items.length,
    },
    success: true,
  })

  return {
    checkoutRequestId: checkoutRequest.id,
    status: checkoutRequest.status,
  }
}

export const getCheckoutRequestStatusForUser = async ({
  checkoutRequestId,
  userId,
}: {
  checkoutRequestId: string
  userId: string
}): Promise<CheckoutRequestStatusResponse> => {
  const checkoutRequest = await findCheckoutRequestById(checkoutRequestId)

  if (!assertOwnership(checkoutRequest, { user: { id: userId } })) {
    throw new CheckoutRequestError('Checkout request not found', 404)
  }

  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId)

  if (existingOrder && checkoutRequest.status !== 'COMPLETED') {
    await updateCheckoutRequestStatus(
      checkoutRequestId,
      'COMPLETED',
      null,
      existingOrder.id
    )
  }

  return buildCheckoutStatusResponse(
    checkoutRequest.id,
    existingOrder ? 'COMPLETED' : checkoutRequest.status,
    existingOrder?.id ?? null,
    existingOrder ? null : (checkoutRequest.errorMessage ?? null)
  )
}

type CheckoutRequestRecord = NonNullable<
  Awaited<ReturnType<typeof db.checkoutRequests.findById>>
>

/**
 * Why a checkout request needs no further processing — a missing row, an order
 * that already exists, or a terminal status.
 */
export type CheckoutSkipReason = 'missing' | 'order_exists' | 'already_settled'

/**
 * Result of the idempotency guard that runs before any work is claimed.
 *
 * `skip` covers every case where the request is already settled — a missing
 * row, an order that already exists, or a terminal status.
 */
export type CheckoutPreflightResult =
  | {
      readonly action: 'skip'
      readonly reason: CheckoutSkipReason
    }
  | {
      readonly action: 'process'
      readonly checkoutRequest: CheckoutRequestRecord
    }

const assertValidCheckoutRequestId = (checkoutRequestId: string): void => {
  const parseResult = CheckoutQueueMessageSchema.safeParse({
    checkoutRequestId,
  })
  if (!parseResult.success) {
    throw new CheckoutRequestError('Invalid checkout queue message', 400)
  }
}

/**
 * Outcome of the read-only settlement check.
 */
export type CheckoutSettlement =
  | { readonly settled: true; readonly reason: CheckoutSkipReason }
  | {
      readonly settled: false
      readonly checkoutRequest: CheckoutRequestRecord
    }

/**
 * Read-only check for whether a checkout request still needs processing.
 *
 * Free of metric side effects — unlike `preflightCheckoutRequest`, which also
 * emits the queue-lag sample and must therefore run once per delivery — so it
 * is safe to repeat within a single delivery. The only write is the
 * self-healing status update when an order already exists.
 */
export const resolveCheckoutSettlement = async (
  checkoutRequestId: string
): Promise<CheckoutSettlement> => {
  const checkoutRequest = await findCheckoutRequestById(checkoutRequestId)

  if (!checkoutRequest) {
    logBusinessEvent({
      event: 'checkout_request_missing',
      details: { checkoutRequestId },
      success: false,
    })
    return { settled: true, reason: 'missing' }
  }

  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId)
  if (existingOrder) {
    if (checkoutRequest.status !== 'COMPLETED') {
      await updateCheckoutRequestStatus(
        checkoutRequestId,
        'COMPLETED',
        null,
        existingOrder.id
      )
    }
    return { settled: true, reason: 'order_exists' }
  }

  if (
    checkoutRequest.status === 'COMPLETED' ||
    checkoutRequest.status === 'FAILED'
  ) {
    return { settled: true, reason: 'already_settled' }
  }

  return { settled: false, checkoutRequest }
}

/**
 * Step 1 — decide whether a checkout request still needs processing.
 *
 * Safe to repeat: it only reads, plus a self-healing status write when an
 * order already exists for the request.
 */
export const preflightCheckoutRequest = async (
  checkoutRequestId: string
): Promise<CheckoutPreflightResult> => {
  assertValidCheckoutRequestId(checkoutRequestId)

  const settlement = await resolveCheckoutSettlement(checkoutRequestId)
  if (settlement.settled) {
    return { action: 'skip', reason: settlement.reason }
  }

  logPerformance({
    operation: CHECKOUT_QUEUE_LAG_OPERATION,
    duration: Date.now() - settlement.checkoutRequest.createdAt.getTime(),
    metadata: { checkoutRequestId },
  })

  return { action: 'process', checkoutRequest: settlement.checkoutRequest }
}

/**
 * Step 2 — compare-and-swap the request into `PROCESSING`.
 *
 * Duplicate webhook deliveries, queue redeliveries and durable-run retries all
 * race here; only the winner goes on to create an order.
 */
export const claimCheckoutRequest = async (
  checkoutRequestId: string
): Promise<boolean> => {
  const claimed =
    await db.checkoutRequests.claimForProcessing(checkoutRequestId)

  if (!claimed) {
    logBusinessEvent({
      event: 'checkout_request_already_processing',
      details: { checkoutRequestId },
      success: true,
    })
  }

  return claimed
}

/**
 * Settle a request whose order already exists, returning that order's id.
 *
 * The order is the source of truth: once one exists the request is `COMPLETED`
 * whatever its column currently says, so this is also the self-heal for a
 * status write that was lost mid-flight.
 *
 * @returns the existing order id, or `null` when no order has been created.
 */
const settleWithExistingOrder = async (
  checkoutRequestId: string
): Promise<string | null> => {
  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId)
  if (!existingOrder) return null

  await updateCheckoutRequestStatus(
    checkoutRequestId,
    'COMPLETED',
    null,
    existingOrder.id
  )
  return existingOrder.id
}

/**
 * Best-effort variant of `settleWithExistingOrder` for the failure path.
 *
 * Losing the original ordering error would be worse than losing the self-heal:
 * `recordCheckoutProcessingFailure` classifies terminal versus transient purely
 * from the error it is handed, so letting a lookup failure propagate in its
 * place would turn "payment declined" into four more retries and a generic
 * retry-exhausted message.
 */
const findSettledOrderAfterFailure = async (
  checkoutRequestId: string
): Promise<string | null> => {
  try {
    return await settleWithExistingOrder(checkoutRequestId)
  } catch (error) {
    logError({
      error,
      context: 'checkout_race_settlement_check_failed',
      additionalInfo: { checkoutRequestId },
    })
    return null
  }
}

// Payment verification and order persistence deliberately stay inside this
// single call: "money confirmed" and "order exists" must either both happen or
// neither, and the caller's claim makes a retry from the top safe.
const createOrderFromCheckoutRequest = (
  checkoutRequest: CheckoutRequestRecord
) =>
  createOrderForUser({
    body: {
      customerName: checkoutRequest.customerName,
      customerEmail: checkoutRequest.customerEmail,
      customerAddress: checkoutRequest.customerAddress,
      addressLine1: checkoutRequest.addressLine1 ?? '',
      addressLine2: checkoutRequest.addressLine2 ?? '',
      addressLine3: checkoutRequest.addressLine3 ?? '',
      pinCode: checkoutRequest.pinCode ?? '',
      city: checkoutRequest.city ?? '',
      state: checkoutRequest.state ?? '',
      items: checkoutRequest.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        customizationNote: item.customizationNote ?? undefined,
      })),
      couponCode: checkoutRequest.couponCode,
      shippingMethod: toShippingMethod(checkoutRequest.shippingMethod),
      payment: buildStoredPaymentReference(checkoutRequest),
    },
    user: {
      id: checkoutRequest.userId,
      name: checkoutRequest.customerName,
      email: checkoutRequest.customerEmail,
    },
    checkoutRequestId: checkoutRequest.id,
  })

const runCheckoutOrderCreation = async (
  checkoutRequest: CheckoutRequestRecord
): Promise<string> => {
  const checkoutRequestId = checkoutRequest.id

  // Re-entry is normal here and must never produce a second attempt: a durable
  // step is retried whenever an attempt dies after its work committed but
  // before its checkpoint persisted, and the claim is memoized so the retry
  // does not go back through the pre-claim guard. Without this the retry would
  // hit `Order_checkoutRequestId_key` / the duplicate-transaction check and the
  // resulting 409 would mark an already-paid request `FAILED`.
  const alreadyCreated = await settleWithExistingOrder(checkoutRequestId)
  if (alreadyCreated) return alreadyCreated

  let result: Awaited<ReturnType<typeof createOrderFromCheckoutRequest>>
  try {
    result = await createOrderFromCheckoutRequest(checkoutRequest)
  } catch (error) {
    // A peer trigger can win the gap between the guard above and the insert:
    // the transient-failure path releases the claim back to `PENDING`, so the
    // payment webhook may claim and complete the request while a durable run
    // is still retrying. Its order is the real one — reporting a failure here
    // would overwrite a `COMPLETED` request that has a paid order behind it.
    const raced = await findSettledOrderAfterFailure(checkoutRequestId)
    if (raced) return raced
    throw error
  }

  await updateCheckoutRequestStatus(
    checkoutRequestId,
    'COMPLETED',
    null,
    result.order.id
  )

  logBusinessEvent({
    event: 'checkout_request_completed',
    details: {
      checkoutRequestId,
      orderId: result.order.id,
      userId: checkoutRequest.userId,
    },
    success: true,
  })

  return result.order.id
}

/**
 * Step 3 — create the order for a claimed checkout request.
 *
 * Idempotent: if an order already exists for the request — because a previous
 * attempt committed before its checkpoint persisted, or because a peer trigger
 * got there first — the existing order is returned and the request is settled
 * rather than a second creation being attempted.
 *
 * @returns the order id for the request.
 */
export const createOrderForCheckoutRequest = async (
  checkoutRequestId: string
): Promise<string> => {
  const checkoutRequest = await findCheckoutRequestById(checkoutRequestId)

  if (!checkoutRequest) {
    throw new CheckoutRequestError('Checkout request not found', 404)
  }

  return runCheckoutOrderCreation(checkoutRequest)
}

/**
 * Step 4 — record a processing failure and classify it.
 *
 * Client-side failures (4xx) are terminal: the request is marked `FAILED` and
 * must not be retried. Everything else is transient, so the request is reset to
 * `PENDING` and the caller re-throws to trigger another delivery.
 */
export const recordCheckoutProcessingFailure = async (
  checkoutRequestId: string,
  error: unknown
): Promise<{ readonly terminal: boolean }> => {
  if (isOrderRequestError(error) && error.status < 500) {
    await updateCheckoutRequestStatus(
      checkoutRequestId,
      'FAILED',
      error.message
    )
    logBusinessEvent({
      event: 'checkout_request_failed',
      details: {
        checkoutRequestId,
        reason: error.message,
        status: error.status,
      },
      success: false,
    })
    return { terminal: true }
  }

  await updateCheckoutRequestStatus(
    checkoutRequestId,
    'PENDING',
    error instanceof Error
      ? error.message
      : 'Temporary checkout processing failure'
  )
  return { terminal: false }
}

/**
 * Process a checkout request end to end inside a single invocation.
 *
 * Used by the Vercel Queue consumer, the payment webhook and the inline
 * fallback. The Inngest function runs the same steps, but checkpoints each one
 * independently so a retry resumes instead of restarting.
 */
export const processCheckoutRequestById = async (
  checkoutRequestId: string
): Promise<void> => {
  const preflight = await preflightCheckoutRequest(checkoutRequestId)
  if (preflight.action === 'skip') return

  const claimed = await claimCheckoutRequest(checkoutRequestId)
  if (!claimed) return

  try {
    await runCheckoutOrderCreation(preflight.checkoutRequest)
  } catch (error) {
    const { terminal } = await recordCheckoutProcessingFailure(
      checkoutRequestId,
      error
    )
    if (terminal) return
    throw error
  }
}
