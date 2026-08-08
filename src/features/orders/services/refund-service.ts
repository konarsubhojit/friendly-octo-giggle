import { and, eq, ne } from 'drizzle-orm'
import { db, primaryDrizzleDb } from '@/lib/db'
import { orderItems, orders, refunds, returnRequests } from '@/lib/schema'
import {
  getPaymentGateway,
  PaymentConfigurationError,
  PaymentVerificationError,
} from '@/lib/payments'
import type { PaymentProvider } from '@/lib/types'
import { fromMinorUnits, roundMoney, sumMoney } from '@/lib/money'
import {
  formatPriceForCurrency,
  isValidCurrencyCode,
  type CurrencyCode,
} from '@/lib/currency'
import { orderRefunded } from '@/features/orders/inngest/events'
import { dispatchWorkflowEvent } from '@/lib/inngest/dispatch'
import { orderSession } from '@/lib/inngest/sessions'
import { notifyOrderRefundUpdate } from '@/lib/notifications/order-notifications'
import { invalidateAdminOrderCaches } from '@/lib/cache'
import { logBusinessEvent, logError } from '@/lib/logger'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import type { UserRole } from '@/lib/constants/roles'
import { restockOrderItems } from './order-restock'

export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED'

/** A refund that could not be issued for a business (not gateway) reason. */
export class RefundRequestError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'RefundRequestError'
    this.status = status
  }
}

export const isRefundRequestError = (
  error: unknown
): error is RefundRequestError => error instanceof RefundRequestError

export interface RefundActor {
  readonly userId: string
  readonly role?: UserRole | null
}

export interface RefundOrderInput {
  readonly orderId: string
  /** Amount in major units; defaults to the full refundable balance. */
  readonly amount?: number
  readonly reason?: string | null
  /** Admin issuing the refund; absent for customer-initiated cancellations. */
  readonly actor?: RefundActor | null
  /** Audit action recorded for the refund (defaults to `refund`). */
  readonly auditAction?: string
  /**
   * Return that caused this refund, when one did. Recorded on the refund row
   * so refund-side reporting can attribute the money to a claim; the return
   * side additionally holds a UNIQUE `refundId` that guards against issuing
   * twice for the same claim.
   */
  readonly returnRequestId?: string | null
}

export interface RefundRecord {
  readonly id: string
  readonly orderId: string
  readonly amount: number
  readonly status: RefundStatus
  readonly gatewayRefundId: string | null
  readonly reason: string | null
}

export interface RefundOrderResult {
  readonly refund: RefundRecord
  /** Total refunded against the order after this refund. */
  readonly refundedTotal: number
  /** Amount that may still be refunded. */
  readonly refundableBalance: number
  readonly restocked: boolean
}

/**
 * Statuses where the goods are still in the warehouse, so a refund can safely
 * return them to inventory. Once an order ships the stock has physically left,
 * and it is only credited back when the parcel is received again.
 */
const RESTOCKABLE_STATUSES = new Set(['PENDING', 'PROCESSING', 'CANCELLED'])

/** Gateway refund states mapped onto the persisted refund lifecycle. */
const mapGatewayStatus = (status: string): RefundStatus => {
  const normalized = status.toLowerCase()
  if (normalized === 'processed') return 'PROCESSED'
  if (normalized === 'failed') return 'FAILED'
  return 'PENDING'
}

/** Payment states that still hold money we are able to refund. */
const REFUNDABLE_PAYMENT_STATUSES = new Set([
  'PAID',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
])

interface LockedOrder {
  id: string
  userId: string | null
  customerEmail: string
  customerName: string
  status: string
  paymentStatus: string
  paymentProvider: PaymentProvider | null
  paymentTransactionId: string | null
  amountPaid: number
  totalAmount: number
}

interface PreparedRefund {
  order: LockedOrder
  refundId: string
  amount: number
  refundedTotal: number
  refundableBalance: number
}

const resolveRefundAmount = (
  requested: number | undefined,
  refundable: number
): number => {
  if (requested === undefined) return refundable

  const amount = roundMoney(requested)
  if (amount <= 0) {
    throw new RefundRequestError('Refund amount must be greater than zero')
  }
  if (amount > refundable) {
    throw new RefundRequestError(
      `Refund amount exceeds the refundable balance of ${refundable}`
    )
  }
  return amount
}

/**
 * Validate the refund and reserve it as a `PENDING` row before any money moves.
 *
 * The order row is locked with `SELECT ... FOR UPDATE` and pending refunds count
 * against the refundable balance, so two concurrent refunds can never
 * over-refund an order even if one is still in flight at the gateway.
 */
const prepareRefund = async ({
  orderId,
  amount,
  reason,
  actor,
  returnRequestId,
}: RefundOrderInput): Promise<PreparedRefund> =>
  primaryDrizzleDb.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        userId: orders.userId,
        customerEmail: orders.customerEmail,
        customerName: orders.customerName,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentProvider: orders.paymentProvider,
        paymentTransactionId: orders.paymentTransactionId,
        amountPaid: orders.amountPaid,
        totalAmount: orders.totalAmount,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for('update')

    if (!order) {
      throw new RefundRequestError('Order not found', 404)
    }

    if (!order.paymentProvider || !order.paymentTransactionId) {
      throw new RefundRequestError('Order has no payment to refund')
    }

    if (!REFUNDABLE_PAYMENT_STATUSES.has(order.paymentStatus)) {
      throw new RefundRequestError(
        'Only paid orders can be refunded',
        order.paymentStatus === 'PENDING' ? 409 : 400
      )
    }

    const reserved = await tx
      .select({ amount: refunds.amount })
      .from(refunds)
      .where(
        and(eq(refunds.orderId, orderId), ne(refunds.status, 'FAILED' as const))
      )

    // One live refund per return, enforced here and by the partial unique
    // index on Refund(returnRequestId). Without this, a crash between the
    // gateway commit and the ReturnRequest.refundId write would leave the
    // return retryable with refundId still null — and the retry would pay the
    // customer a second time for the same goods.
    if (returnRequestId) {
      const [claimed] = await tx
        .select({ id: refunds.id })
        .from(refunds)
        .where(
          and(
            eq(refunds.returnRequestId, returnRequestId),
            ne(refunds.status, 'FAILED' as const)
          )
        )
        .limit(1)

      if (claimed) {
        throw new RefundRequestError(
          'A refund has already been issued for this return',
          409
        )
      }
    }

    const refundedTotal = sumMoney(reserved.map((row) => row.amount))
    const refundable = roundMoney(order.amountPaid - refundedTotal)

    if (refundable <= 0) {
      throw new RefundRequestError('Order has already been fully refunded', 409)
    }

    const refundAmount = resolveRefundAmount(amount, refundable)

    const [created] = await tx
      .insert(refunds)
      .values({
        orderId,
        provider: order.paymentProvider,
        paymentTransactionId: order.paymentTransactionId,
        returnRequestId: returnRequestId ?? null,
        amount: refundAmount,
        status: 'PENDING',
        reason: reason ?? null,
        initiatedById: actor?.userId ?? null,
      })
      .returning({ id: refunds.id })

    return {
      order,
      refundId: created.id,
      amount: refundAmount,
      refundedTotal: roundMoney(refundedTotal + refundAmount),
      refundableBalance: roundMoney(refundable - refundAmount),
    }
  })

const markRefundFailed = async (
  refundId: string,
  errorMessage: string
): Promise<void> => {
  await primaryDrizzleDb
    .update(refunds)
    .set({ status: 'FAILED', errorMessage, updatedAt: new Date() })
    .where(eq(refunds.id, refundId))
}

/**
 * Persist the gateway outcome and, for a fully refunded order, return its stock.
 *
 * Shipped and delivered orders are never restocked automatically: the goods
 * have left the warehouse, so inventory is corrected by hand once they come
 * back.
 */
const settleRefund = async ({
  prepared,
  gatewayRefundId,
  status,
}: {
  prepared: PreparedRefund
  gatewayRefundId: string
  status: RefundStatus
}): Promise<boolean> =>
  primaryDrizzleDb.transaction(async (tx) => {
    await tx
      .update(refunds)
      .set({
        gatewayRefundId,
        status,
        processedAt: status === 'PROCESSED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, prepared.refundId))

    await tx
      .update(orders)
      .set({
        paymentStatus:
          prepared.refundableBalance > 0 ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, prepared.order.id))

    if (
      prepared.refundableBalance > 0 ||
      !RESTOCKABLE_STATUSES.has(prepared.order.status)
    ) {
      return false
    }

    const items = await tx
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, prepared.order.id))

    return restockOrderItems(tx, { id: prepared.order.id, items })
  })

const resolveCurrency = async (
  userId: string | null
): Promise<CurrencyCode> => {
  if (!userId) return 'INR'
  try {
    const user = await db.users.findPreferences(userId)
    return user?.currencyPreference &&
      isValidCurrencyCode(user.currencyPreference)
      ? user.currencyPreference
      : 'INR'
  } catch (error) {
    logError({ error, context: 'refund_currency_lookup_failed' })
    return 'INR'
  }
}

/**
 * Announce that a refund was recorded.
 *
 * The email is a subscriber to `order/refunded`, so it retries on its own and
 * a mail-provider outage can no longer add latency to — or fail — the refund
 * request itself. The inline notification survives only as the fallback for
 * environments without Inngest configured.
 */
export const dispatchRefundNotification = async ({
  order,
  refundId,
  amount,
  status,
  isPartial,
  reason,
}: {
  order: Pick<LockedOrder, 'id' | 'userId' | 'customerEmail' | 'customerName'>
  /** Distinguishes repeat partial refunds, which each earn their own email. */
  refundId: string
  amount: number
  status: RefundStatus
  isPartial: boolean
  reason?: string | null
}): Promise<void> => {
  const currencyCode = await resolveCurrency(order.userId)

  const dispatchResult = await dispatchWorkflowEvent({
    event: orderRefunded.create(
      {
        orderId: order.id,
        refundId,
        userId: order.userId,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        refundAmount: amount,
        refundStatus: status,
        isPartial,
        reason: reason ?? null,
        currencyCode,
      },
      { meta: { sessions: orderSession(order.id) } }
    ),
    context: 'order_refunded_publish_failed',
    details: { orderId: order.id, refundId, status },
    fallback: () =>
      notifyOrderRefundUpdate({
        to: order.customerEmail,
        customerName: order.customerName,
        orderId: order.id,
        status,
        refundAmount: formatPriceForCurrency(amount, currencyCode),
        isPartial,
        reason: reason ?? null,
      }),
  })

  logBusinessEvent({
    event: 'order_refund_email_queued',
    details: { orderId: order.id, refundId, status, dispatch: dispatchResult },
    success: true,
  })
}

/**
 * Refund an order in full or in part through its payment gateway.
 *
 * The refund is reserved in the database before the gateway is called and
 * settled afterwards, so a refund that fails mid-flight stays visible instead of
 * silently disappearing, and the reserved amount keeps concurrent refunds from
 * exceeding the amount the customer actually paid.
 */
export const refundOrder = async (
  input: RefundOrderInput
): Promise<RefundOrderResult> => {
  const prepared = await prepareRefund(input)
  const { order, refundId, amount } = prepared

  let gatewayRefundId: string
  let status: RefundStatus

  try {
    const gateway = getPaymentGateway(order.paymentProvider as PaymentProvider)
    const gatewayRefund = await gateway.refund({
      paymentTransactionId: order.paymentTransactionId as string,
      amount,
    })
    gatewayRefundId = gatewayRefund.refundId
    status = mapGatewayStatus(gatewayRefund.status)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Refund request failed'
    await markRefundFailed(refundId, message)
    logError({
      error,
      context: 'order_refund_gateway_failed',
      additionalInfo: { orderId: order.id, refundId },
    })

    if (
      error instanceof PaymentVerificationError ||
      error instanceof PaymentConfigurationError
    ) {
      throw new RefundRequestError(message, error.status)
    }
    throw error
  }

  if (status === 'FAILED') {
    await markRefundFailed(refundId, 'The payment gateway rejected the refund')
    await dispatchRefundNotification({
      order,
      refundId,
      amount,
      status,
      isPartial: prepared.refundableBalance > 0,
      reason: input.reason,
    })
    throw new RefundRequestError('The payment gateway rejected the refund', 502)
  }

  const restocked = await settleRefund({ prepared, gatewayRefundId, status })

  await invalidateAdminOrderCaches(order.id, order.userId)

  if (input.actor?.userId) {
    await recordAdminAuditLog({
      userId: input.actor.userId,
      role: input.actor.role,
      entity: 'order',
      entityId: order.id,
      action: input.auditAction ?? 'refund',
      diff: {
        refundId,
        gatewayRefundId,
        amount,
        status,
        reason: input.reason ?? null,
        restocked,
      },
    }).catch((error) =>
      logError({ error, context: 'order_refund_audit_log_failed' })
    )
  }

  logBusinessEvent({
    event: 'order_refunded',
    details: {
      orderId: order.id,
      refundId,
      amount,
      status,
      partial: prepared.refundableBalance > 0,
      restocked,
    },
    success: true,
  })

  await dispatchRefundNotification({
    order,
    refundId,
    amount,
    status,
    isPartial: prepared.refundableBalance > 0,
    reason: input.reason,
  })

  return {
    refund: {
      id: refundId,
      orderId: order.id,
      amount,
      status,
      gatewayRefundId,
      reason: input.reason ?? null,
    },
    refundedTotal: prepared.refundedTotal,
    refundableBalance: prepared.refundableBalance,
    restocked,
  }
}

export interface RefundWebhookInput {
  readonly provider: PaymentProvider
  readonly gatewayRefundId: string
  readonly paymentTransactionId: string
  readonly status: Extract<RefundStatus, 'PROCESSED' | 'FAILED'>
  /** Refunded amount in minor units, when the gateway sends one. */
  readonly amountInMinorUnits: number | null
}

interface RefundWebhookOutcome {
  order: Pick<LockedOrder, 'id' | 'userId' | 'customerEmail' | 'customerName'>
  /** Local refund row id, needed to key the notification per refund. */
  refundId: string
  amount: number
  isPartial: boolean
  restocked: boolean
}

type RefundTransaction = Parameters<
  Parameters<typeof primaryDrizzleDb.transaction>[0]
>[0]

/**
 * Return a claim to `RECEIVED` when its refund is reported failed.
 *
 * The gateway can accept a refund as `PENDING` and reject it later, by which
 * point the return is already closed as `REFUNDED`. That state is a dead end:
 * `settle` requires a `PENDING` refund row, `refund` is not permitted from
 * `REFUNDED`, and the customer is shown "processing" indefinitely — with the
 * goods already restocked. Reopening restores the retry path so the claim can
 * actually be paid.
 */
const reopenFailedReturn = async (
  tx: RefundTransaction,
  refundId: string
): Promise<void> => {
  await tx
    .update(returnRequests)
    .set({ status: 'RECEIVED', refundId: null, updatedAt: new Date() })
    .where(eq(returnRequests.refundId, refundId))
}

/**
 * Bring the local refund row in line with the gateway's report.
 *
 * A refund issued from the gateway's own dashboard has no local row, so one is
 * created; refunds we issued are matched on the unique `gatewayRefundId`.
 */
const upsertWebhookRefund = async (
  tx: RefundTransaction,
  {
    input,
    orderId,
    existing,
  }: {
    input: RefundWebhookInput
    orderId: string
    existing: { id: string; amount: number } | undefined
  }
): Promise<{ refundId: string; amount: number }> => {
  const processedAt = input.status === 'PROCESSED' ? new Date() : null

  if (existing) {
    await tx
      .update(refunds)
      .set({
        status: input.status,
        processedAt,
        errorMessage:
          input.status === 'FAILED'
            ? 'The payment gateway reported the refund as failed'
            : null,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, existing.id))

    if (input.status === 'FAILED') {
      await reopenFailedReturn(tx, existing.id)
    }

    return { refundId: existing.id, amount: existing.amount }
  }

  const webhookAmount =
    input.amountInMinorUnits === null
      ? null
      : fromMinorUnits(input.amountInMinorUnits)

  if (webhookAmount === null || webhookAmount <= 0) {
    throw new PaymentVerificationError(
      'Invalid refund amount in webhook payload'
    )
  }

  const [created] = await tx
    .insert(refunds)
    .values({
      orderId,
      provider: input.provider,
      paymentTransactionId: input.paymentTransactionId,
      gatewayRefundId: input.gatewayRefundId,
      amount: webhookAmount,
      status: input.status,
      reason: 'Refund reported by payment gateway',
      processedAt,
    })
    .returning({ id: refunds.id })

  return { refundId: created.id, amount: webhookAmount }
}

/**
 * Apply a `refund.processed` / `refund.failed` delivery to the refund ledger.
 *
 * Refunds issued from the gateway's own dashboard have no local row, so the
 * webhook creates one; refunds we issued are matched on `gatewayRefundId`,
 * which is unique, making repeated deliveries idempotent.
 *
 * @returns the reconciled refund, or `null` when the delivery is a no-op.
 */
export const reconcileRefundWebhook = async (
  input: RefundWebhookInput
): Promise<RefundWebhookOutcome | null> => {
  const outcome = await primaryDrizzleDb.transaction(
    async (tx): Promise<RefundWebhookOutcome | null> => {
      const [order] = await tx
        .select({
          id: orders.id,
          userId: orders.userId,
          customerEmail: orders.customerEmail,
          customerName: orders.customerName,
          status: orders.status,
          amountPaid: orders.amountPaid,
        })
        .from(orders)
        .where(eq(orders.paymentTransactionId, input.paymentTransactionId))
        .limit(1)
        .for('update')

      if (!order) {
        return null
      }

      const [existing] = await tx
        .select({
          id: refunds.id,
          amount: refunds.amount,
          status: refunds.status,
          reason: refunds.reason,
        })
        .from(refunds)
        .where(eq(refunds.gatewayRefundId, input.gatewayRefundId))
        .limit(1)

      if (existing?.status === input.status) {
        return null
      }

      const { refundId, amount } = await upsertWebhookRefund(tx, {
        input,
        orderId: order.id,
        existing,
      })

      const reserved = await tx
        .select({ amount: refunds.amount })
        .from(refunds)
        .where(
          and(
            eq(refunds.orderId, order.id),
            ne(refunds.status, 'FAILED' as const)
          )
        )
      const refundedTotal = sumMoney(reserved.map((row) => row.amount))
      const isPartial = roundMoney(order.amountPaid - refundedTotal) > 0

      let paymentStatus: 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED' = 'PAID'
      if (refundedTotal > 0) {
        paymentStatus = isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED'
      }

      await tx
        .update(orders)
        .set({ paymentStatus, updatedAt: new Date() })
        .where(eq(orders.id, order.id))

      let restocked = false
      if (
        input.status === 'PROCESSED' &&
        !isPartial &&
        RESTOCKABLE_STATUSES.has(order.status)
      ) {
        const items = await tx
          .select({
            variantId: orderItems.variantId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id))
        restocked = await restockOrderItems(tx, { id: order.id, items })
      }

      logBusinessEvent({
        event: 'order_refund_webhook_reconciled',
        details: {
          orderId: order.id,
          refundId,
          gatewayRefundId: input.gatewayRefundId,
          status: input.status,
          restocked,
        },
        success: true,
      })

      return { order, refundId, amount, isPartial, restocked }
    }
  )

  if (!outcome) {
    return null
  }

  await invalidateAdminOrderCaches(outcome.order.id, outcome.order.userId)
  await dispatchRefundNotification({
    order: outcome.order,
    refundId: outcome.refundId,
    amount: outcome.amount,
    status: input.status,
    isPartial: outcome.isPartial,
  })

  return outcome
}
