import { and, eq, isNull, ne } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import {
  orders,
  productVariants,
  refunds,
  returnItems,
  returnRequests,
} from '@/lib/schema'
import { roundMoney, sumMoney } from '@/lib/money'
import { logBusinessEvent, logError } from '@/lib/logger'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { dispatchWorkflowEvent } from '@/lib/inngest/dispatch'
import { orderSession } from '@/lib/inngest/sessions'
import { returnStatusChanged } from '@/features/orders/inngest/events'
import { deliverReturnStatusNotification } from '@/lib/notifications/order-notifications'
import { formatPriceForCurrency } from '@/lib/currency'
import type { UserRole } from '@/lib/constants/roles'
import {
  MANUAL_SETTLEMENT_REASON_PREFIX,
  type ReturnAction,
  type ReturnStatus,
} from '@/lib/constants/returns'
import { refundOrder } from './refund-service'
import { restockReturnItems } from './return-restock'
import { assertTransition } from './return-state-machine'
import { ReturnRequestError } from './return-service'

export interface ReturnActor {
  readonly userId: string
  readonly role?: UserRole | null
}

export interface DecideReturnResult {
  readonly id: string
  /** The order the return belongs to — the key both cache families are held under. */
  readonly orderId: string
  /** The customer who filed it, so their cached order views can be invalidated. */
  readonly userId: string
  readonly status: ReturnStatus
  readonly restocked: boolean
  /** Products whose stock this action returned to the shelf, if any. */
  readonly restockedProductIds: readonly string[]
  readonly refund: {
    readonly id: string
    readonly amount: number
    readonly status: string
  } | null
}

/**
 * Advance a return through its lifecycle.
 *
 * Every action re-reads the return row `FOR UPDATE` before checking the
 * transition, so two administrators acting at once serialise: the second sees
 * the state the first produced and is rejected by the transition table rather
 * than both succeeding against a stale read.
 *
 * `refund` is the exception and is handled separately: it calls a payment
 * gateway, and an external HTTP round-trip must never happen while a row lock
 * and a pooled connection are held. See `runRefund`.
 */
export const decideReturn = async (
  returnId: string,
  action: ReturnAction,
  actor: ReturnActor,
  decisionReason?: string
): Promise<DecideReturnResult> => {
  const outcome =
    action === 'refund'
      ? await runRefund(returnId, actor)
      : await primaryDrizzleDb.transaction(async (tx) => {
          const current = await lockReturn(tx, returnId)

          // Throws ReturnTransitionError, which the route maps to 409 along
          // with the current state so the client can re-render rather than
          // guess.
          const nextStatus = assertTransition(current.status, action)

          switch (action) {
            case 'approve':
            case 'reject':
              return applyDecision(
                tx,
                current,
                nextStatus,
                actor,
                decisionReason
              )
            case 'receive':
              return applyReceive(tx, current, actor)
            case 'settle':
              return applySettle(tx, current, actor)
          }
        })

  await recordAdminAuditLog({
    userId: actor.userId,
    role: actor.role,
    entity: 'return',
    entityId: returnId,
    action,
    diff: {
      fromStatus: outcome.previousStatus,
      toStatus: outcome.status,
      decisionReason: decisionReason ?? null,
      restocked: outcome.restocked,
      refundId: outcome.refund?.id ?? null,
    },
  })

  logBusinessEvent({
    event: `return_${action}`,
    details: {
      returnId,
      orderId: outcome.orderId,
      fromStatus: outcome.previousStatus,
      toStatus: outcome.status,
    },
    success: true,
  })

  // `settle` moves money without moving the return's own status, so announcing
  // it would send the customer a second identical "refunded" email.
  if (outcome.previousStatus !== outcome.status) {
    await announceReturnStatus(returnId, outcome, decisionReason)
  }

  return {
    id: returnId,
    orderId: outcome.orderId,
    userId: outcome.userId,
    status: outcome.status,
    restocked: outcome.restocked,
    restockedProductIds: outcome.restockedProductIds,
    refund: outcome.refund,
  }
}

/** Read a return row under a row lock, or report it missing. */
const lockReturn = async (
  tx: ReturnTransaction,
  returnId: string
): Promise<CurrentReturn> => {
  const [current] = await tx
    .select({
      id: returnRequests.id,
      orderId: returnRequests.orderId,
      userId: returnRequests.userId,
      status: returnRequests.status,
      refundId: returnRequests.refundId,
      refundAmount: returnRequests.refundAmount,
      stockRestoredAt: returnRequests.stockRestoredAt,
    })
    .from(returnRequests)
    .where(eq(returnRequests.id, returnId))
    .limit(1)
    .for('update')

  if (!current) {
    throw new ReturnRequestError('Return not found', 404)
  }

  return current
}

type ReturnTransaction = Parameters<
  Parameters<typeof primaryDrizzleDb.transaction>[0]
>[0]

interface CurrentReturn {
  readonly id: string
  readonly orderId: string
  readonly userId: string
  readonly status: ReturnStatus
  readonly refundId: string | null
  readonly refundAmount: number
  readonly stockRestoredAt: Date | null
}

interface TransitionOutcome {
  readonly orderId: string
  readonly userId: string
  readonly previousStatus: ReturnStatus
  readonly status: ReturnStatus
  readonly restocked: boolean
  readonly restockedProductIds: readonly string[]
  readonly refund: DecideReturnResult['refund']
}

/** Approve or reject: both require a recorded reason (FR-008). */
const applyDecision = async (
  tx: ReturnTransaction,
  current: CurrentReturn,
  nextStatus: ReturnStatus,
  actor: ReturnActor,
  decisionReason?: string
): Promise<TransitionOutcome> => {
  if (!decisionReason?.trim()) {
    throw new ReturnRequestError('A reason is required', 400)
  }

  await tx
    .update(returnRequests)
    .set({
      status: nextStatus,
      decisionReason: decisionReason.trim(),
      decidedById: actor.userId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(returnRequests.id, current.id))

  return {
    orderId: current.orderId,
    userId: current.userId,
    previousStatus: current.status,
    status: nextStatus,
    restocked: false,
    restockedProductIds: [],
    refund: null,
  }
}

/**
 * Acknowledge the goods and return them to stock.
 *
 * Moves inventory only — no money. The refund is a separate, separately
 * permissioned action, which is what lets a gateway rejection be retried
 * without re-restocking.
 */
const applyReceive = async (
  tx: ReturnTransaction,
  current: CurrentReturn,
  actor: ReturnActor
): Promise<TransitionOutcome> => {
  const items = await tx
    .select({
      variantId: returnItems.variantId,
      quantity: returnItems.quantity,
      productId: productVariants.productId,
    })
    .from(returnItems)
    .innerJoin(productVariants, eq(returnItems.variantId, productVariants.id))
    .where(eq(returnItems.returnRequestId, current.id))

  const restocked = await restockReturnItems(tx, {
    id: current.id,
    items,
  })

  await tx
    .update(returnRequests)
    .set({
      status: 'RECEIVED',
      receivedById: actor.userId,
      receivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(returnRequests.id, current.id))

  return {
    orderId: current.orderId,
    userId: current.userId,
    previousStatus: current.status,
    status: 'RECEIVED',
    restocked,
    // Only report products whose stock actually moved, so a replayed receive
    // does not churn the product caches.
    restockedProductIds: restocked
      ? [...new Set(items.map((item) => item.productId))]
      : [],
    refund: null,
  }
}

/**
 * Issue the money, in three phases with no transaction open across the gateway.
 *
 * An external HTTP round-trip must never happen while a row lock and a pooled
 * connection are held: concurrent refunds would each hold one connection while
 * waiting for a second, deadlocking the pool, and the lock would block any
 * customer filing a return against the same order for the gateway's latency.
 *
 * Splitting the phases means the gateway can commit while the follow-up write
 * fails. `refundOrder` is the guard against that becoming a double refund: it
 * refuses a second live refund for the same return, backed by a partial unique
 * index on `Refund(returnRequestId)`.
 */
const runRefund = async (
  returnId: string,
  actor: ReturnActor
): Promise<TransitionOutcome> => {
  // Phase 1 — validate the transition under a lock, then release it.
  const claim = await primaryDrizzleDb.transaction(async (tx) => {
    const current = await lockReturn(tx, returnId)
    assertTransition(current.status, 'refund')

    if (current.refundId) {
      const [existing] = await tx
        .select({
          id: refunds.id,
          amount: refunds.amount,
          status: refunds.status,
        })
        .from(refunds)
        .where(eq(refunds.id, current.refundId))
        .limit(1)

      return { current, settled: existing ?? null }
    }

    const [order] = await tx
      .select({
        id: orders.id,
        paymentProvider: orders.paymentProvider,
      })
      .from(orders)
      .where(eq(orders.id, current.orderId))
      .limit(1)

    if (!order) {
      throw new ReturnRequestError('Order not found', 404)
    }

    return { current, settled: null, provider: order.paymentProvider }
  })

  const { current } = claim

  // Already refunded — return unchanged rather than issuing a second one.
  if (claim.settled) {
    return {
      orderId: current.orderId,
      userId: current.userId,
      previousStatus: current.status,
      status: 'REFUNDED',
      restocked: false,
      restockedProductIds: [],
      refund: claim.settled,
    }
  }

  // Phase 2 — move the money with no transaction open.
  const refund =
    claim.provider === 'COD'
      ? await createManualSettlement(current, actor)
      : await createGatewayRefund(current, actor)

  // Phase 3 — record the outcome. A failure here leaves the return at
  // `RECEIVED` with the money already sent; the retry is safe because
  // `refundOrder` refuses a second live refund for this return.
  await primaryDrizzleDb
    .update(returnRequests)
    .set({
      status: 'REFUNDED',
      refundId: refund.id,
      updatedAt: new Date(),
    })
    .where(eq(returnRequests.id, current.id))

  return {
    orderId: current.orderId,
    userId: current.userId,
    previousStatus: current.status,
    status: 'REFUNDED',
    restocked: false,
    restockedProductIds: [],
    refund,
  }
}

/**
 * Record a Cash on Delivery obligation and mark the order refunded.
 *
 * No gateway call: COD captured nothing, so there is nothing to reverse. The
 * row is written `PENDING` with a `MANUAL_SETTLEMENT:` reason prefix and stays
 * that way until an operator confirms the money changed hands. Recording it —
 * rather than skipping the refund — is what keeps the obligation visible and
 * the order's refund total reconcilable.
 *
 * `paymentStatus` moves with it, because every downstream consumer — admin
 * filters, sales aggregates, exports, and the refundable-balance gate — reads
 * that column rather than the refund ledger. Leaving it `PAID` would overstate
 * revenue by the refunded amount.
 */
const createManualSettlement = async (
  current: CurrentReturn,
  actor: ReturnActor
) =>
  primaryDrizzleDb.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        amountPaid: orders.amountPaid,
      })
      .from(orders)
      .where(eq(orders.id, current.orderId))
      .limit(1)
      .for('update')

    if (!order) {
      throw new ReturnRequestError('Order not found', 404)
    }

    // A COD return competes for the same refundable balance as any admin
    // refund, so it is counted against the same ledger.
    const reserved = await tx
      .select({ amount: refunds.amount })
      .from(refunds)
      .where(
        and(
          eq(refunds.orderId, current.orderId),
          ne(refunds.status, 'FAILED' as const)
        )
      )

    const refundedTotal = sumMoney(reserved.map((row) => row.amount))
    const refundable = roundMoney(order.amountPaid - refundedTotal)

    if (current.refundAmount > refundable) {
      throw new ReturnRequestError(
        'This return exceeds the order’s refundable balance',
        409
      )
    }

    const [created] = await tx
      .insert(refunds)
      .values({
        orderId: current.orderId,
        provider: 'COD',
        paymentTransactionId: null,
        gatewayRefundId: null,
        returnRequestId: current.id,
        amount: current.refundAmount,
        status: 'PENDING',
        reason: `${MANUAL_SETTLEMENT_REASON_PREFIX} return ${current.id}`,
        initiatedById: actor.userId,
      })
      .returning({
        id: refunds.id,
        amount: refunds.amount,
        status: refunds.status,
      })

    if (!created) {
      throw new ReturnRequestError('The refund could not be recorded', 500)
    }

    await tx
      .update(orders)
      .set({
        paymentStatus:
          roundMoney(refundable - current.refundAmount) > 0
            ? 'PARTIALLY_REFUNDED'
            : 'REFUNDED',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, current.orderId))

    return created
  })

/**
 * Issue through the payment gateway.
 *
 * Delegates to `refundOrder`, which owns the order lock and the refundable
 * balance check — the authority on never over-refunding an order. A gateway
 * rejection propagates, rolling back the status change and leaving the return
 * at `RECEIVED` so the action can be retried.
 */
const createGatewayRefund = async (
  current: CurrentReturn,
  actor: ReturnActor
) => {
  const result = await refundOrder({
    orderId: current.orderId,
    amount: current.refundAmount,
    reason: `Return ${current.id}`,
    actor,
    auditAction: 'return_refund',
    returnRequestId: current.id,
  })

  return {
    id: result.refund.id,
    amount: result.refund.amount,
    status: result.refund.status,
  }
}

/**
 * Mark a Cash on Delivery obligation as paid.
 *
 * Restricted to COD manual settlements. A gateway refund legitimately sits
 * `PENDING` while the provider processes it, and settling one would assert the
 * money changed hands when it has not — a claim the webhook would then no-op
 * on, so the false confirmation would never be corrected.
 */
const applySettle = async (
  tx: ReturnTransaction,
  current: CurrentReturn,
  actor: ReturnActor
): Promise<TransitionOutcome> => {
  if (!current.refundId) {
    throw new ReturnRequestError('This return has no refund to settle', 409)
  }

  const [settled] = await tx
    .update(refunds)
    .set({
      status: 'PROCESSED',
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(refunds.id, current.refundId),
        eq(refunds.status, 'PENDING'),
        eq(refunds.provider, 'COD'),
        isNull(refunds.paymentTransactionId)
      )
    )
    .returning({
      id: refunds.id,
      amount: refunds.amount,
      status: refunds.status,
    })

  if (!settled) {
    throw new ReturnRequestError(
      'This refund is not awaiting manual settlement',
      409
    )
  }

  logBusinessEvent({
    event: 'return_settled',
    details: {
      returnId: current.id,
      refundId: settled.id,
      actor: actor.userId,
    },
    success: true,
  })

  return {
    orderId: current.orderId,
    userId: current.userId,
    previousStatus: current.status,
    status: 'REFUNDED',
    restocked: false,
    restockedProductIds: [],
    refund: settled,
  }
}

/**
 * Tell the customer their return moved.
 *
 * Published through Inngest so delivery survives a provider blip, with an
 * inline fallback for environments where Inngest is unconfigured — the
 * customer is told either way. Notification failure never propagates: the
 * money and inventory have already moved, and rolling those back because an
 * email bounced would be far worse than a missed message.
 */
const announceReturnStatus = async (
  returnId: string,
  outcome: TransitionOutcome,
  decisionReason?: string
): Promise<void> => {
  try {
    const [context] = await primaryDrizzleDb
      .select({
        userId: orders.userId,
        customerEmail: orders.customerEmail,
        customerName: orders.customerName,
        refundAmount: returnRequests.refundAmount,
      })
      .from(returnRequests)
      .innerJoin(orders, eq(returnRequests.orderId, orders.id))
      .where(eq(returnRequests.id, returnId))
      .limit(1)

    if (!context) return

    const refundAmount =
      outcome.status === 'REFUNDED' ? context.refundAmount : null

    await dispatchWorkflowEvent({
      event: returnStatusChanged.create(
        {
          returnId,
          orderId: outcome.orderId,
          userId: context.userId,
          customerEmail: context.customerEmail,
          customerName: context.customerName,
          status: outcome.status,
          decisionReason: decisionReason ?? null,
          refundAmount,
        },
        { meta: { sessions: orderSession(outcome.orderId) } }
      ),
      context: 'return_status_publish_failed',
      details: { returnId, status: outcome.status },
      fallback: () =>
        deliverReturnStatusNotification({
          to: context.customerEmail,
          customerName: context.customerName,
          orderId: outcome.orderId,
          returnId,
          status: outcome.status,
          decisionReason: decisionReason ?? null,
          refundAmount:
            refundAmount === null
              ? null
              : formatPriceForCurrency(refundAmount, 'INR'),
        }).then(() => undefined),
    })
  } catch (error) {
    logError({ error, context: 'return_status_announce_failed' })
  }
}
