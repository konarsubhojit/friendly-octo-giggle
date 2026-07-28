// Architecture note: Checkout uses API routes + Vercel Queue rather than
// server actions. The queue provides durable delivery, automatic retries,
// and idempotency via checkout request IDs — critical for payment-adjacent
// workflows where exactly-once processing matters. See also
// features/orders/actions/orders.ts for the server action counterpart used
// for simpler order reads and search operations.

import { waitUntil } from '@vercel/functions'
import { db } from '@/lib/db'
import {
  createOrderForUser,
  isOrderRequestError,
} from '@/features/orders/services/order-service'
import { send } from '@/lib/queue'
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
import { inngest, isInngestConfigured } from '@/lib/inngest/client'
import { checkoutRequestCreated } from '@/features/cart/inngest/events'
import type { CheckoutPaymentInput } from '@/lib/types'

export const CHECKOUT_QUEUE_TOPIC = 'checkout-orders'

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

const updateCheckoutRequestStatus = async (
  checkoutRequestId: string,
  status: CheckoutRequestStatus,
  errorMessage: string | null
) => {
  await db.checkoutRequests.updateStatus(
    checkoutRequestId,
    status,
    errorMessage
  )
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
    await updateCheckoutRequestStatus(checkoutRequestId, 'COMPLETED', null)
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
 * Hand a checkout request to its durable orchestrator.
 *
 * Inngest is preferred when configured: each pipeline step checkpoints
 * independently, so a retry resumes after the last completed step instead of
 * replaying payment verification. The Vercel Queue remains the fallback so a
 * deployment without Inngest credentials — or a transient Inngest outage —
 * still processes checkouts durably.
 *
 * Throws when every durable transport fails, letting the caller decide on the
 * inline last resort.
 */
const dispatchCheckoutProcessing = async ({
  checkoutRequestId,
  userId,
}: {
  checkoutRequestId: string
  userId: string
}): Promise<void> => {
  if (isInngestConfigured()) {
    try {
      await inngest.send(checkoutRequestCreated.create({ checkoutRequestId }))
      return
    } catch (error) {
      logError({
        error,
        context: 'checkout_inngest_publish_failed_falling_back_to_queue',
        additionalInfo: { checkoutRequestId, userId },
      })
    }
  }

  await send(
    CHECKOUT_QUEUE_TOPIC,
    { checkoutRequestId },
    { idempotencyKey: `checkout-request:${checkoutRequestId}` }
  )
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
      context: 'checkout_queue_publish_failed_using_inline_fallback',
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
    await updateCheckoutRequestStatus(checkoutRequestId, 'COMPLETED', null)
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
 * Result of the idempotency guard that runs before any work is claimed.
 *
 * `skip` covers every case where the request is already settled — a missing
 * row, an order that already exists, or a terminal status.
 */
export type CheckoutPreflightResult =
  | {
      readonly action: 'skip'
      readonly reason: 'missing' | 'order_exists' | 'already_settled'
    }
  | { readonly action: 'process'; readonly checkoutRequest: CheckoutRequestRecord }

const assertValidCheckoutRequestId = (checkoutRequestId: string): void => {
  const parseResult = CheckoutQueueMessageSchema.safeParse({
    checkoutRequestId,
  })
  if (!parseResult.success) {
    throw new CheckoutRequestError('Invalid checkout queue message', 400)
  }
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

  const checkoutRequest = await findCheckoutRequestById(checkoutRequestId)

  if (!checkoutRequest) {
    logBusinessEvent({
      event: 'checkout_request_missing',
      details: { checkoutRequestId },
      success: false,
    })
    return { action: 'skip', reason: 'missing' }
  }

  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId)
  if (existingOrder) {
    if (checkoutRequest.status !== 'COMPLETED') {
      await updateCheckoutRequestStatus(checkoutRequestId, 'COMPLETED', null)
    }
    return { action: 'skip', reason: 'order_exists' }
  }

  if (
    checkoutRequest.status === 'COMPLETED' ||
    checkoutRequest.status === 'FAILED'
  ) {
    return { action: 'skip', reason: 'already_settled' }
  }

  logPerformance({
    operation: CHECKOUT_QUEUE_LAG_OPERATION,
    duration: Date.now() - checkoutRequest.createdAt.getTime(),
    metadata: { checkoutRequestId },
  })

  return { action: 'process', checkoutRequest }
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

const runCheckoutOrderCreation = async (
  checkoutRequest: CheckoutRequestRecord
): Promise<string> => {
  const checkoutRequestId = checkoutRequest.id

  // Payment verification and order persistence deliberately stay inside this
  // single call: "money confirmed" and "order exists" must either both happen
  // or neither, and the claim above makes a retry from the top safe.
  const result = await createOrderForUser({
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
    checkoutRequestId,
  })

  await updateCheckoutRequestStatus(checkoutRequestId, 'COMPLETED', null)

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
 * @returns the created order id.
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
