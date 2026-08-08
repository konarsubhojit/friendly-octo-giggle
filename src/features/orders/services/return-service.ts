import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import {
  orders,
  orderItems,
  products,
  refunds,
  returnEvidence,
  returnItems,
  returnRequests,
} from '@/lib/schema'
import { getReturnsConfig } from '@/lib/edge-config'
import { logBusinessEvent } from '@/lib/logger'
import { roundMoney, sumMoney } from '@/lib/money'
import {
  RETURN_EVIDENCE_MAX,
  type ReturnIneligibilityReason,
  type ReturnReason,
} from '@/lib/constants/returns'
import { calculateReturnRefund } from './return-refund-calculator'
import type { CreateReturnRequestInput } from '../validations'

/**
 * Raised for every rejected return operation. `status` is the HTTP status the
 * route should return; `code` is the machine-readable discriminator the client
 * uses to render a precise message rather than a generic failure.
 */
export class ReturnRequestError extends Error {
  readonly status: number
  readonly code?:
    | ReturnIneligibilityReason
    | 'QUANTITY_EXCEEDED'
    | 'AMOUNT_EXCEEDED'

  constructor(
    message: string,
    status = 400,
    code?: ReturnRequestError['code']
  ) {
    super(message)
    this.name = 'ReturnRequestError'
    this.status = status
    this.code = code
  }
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export interface ReturnEligibilityItem {
  readonly orderItemId: string
  readonly productId: string
  readonly variantId: string
  readonly name: string
  readonly orderedQuantity: number
  readonly returnedQuantity: number
  readonly returnableQuantity: number
  readonly unitPrice: number
}

export interface ReturnEligibility {
  readonly isReturnable: boolean
  readonly reason: ReturnIneligibilityReason | null
  readonly deliveredAt: string | null
  readonly windowExpiresAt: string | null
  readonly items: readonly ReturnEligibilityItem[]
  /**
   * Claims already raised against this order. Returned alongside eligibility
   * so order detail can show a customer their open claims in one round trip
   * rather than a second request per return.
   */
  readonly returns: readonly CustomerReturnSummary[]
}

export interface CustomerReturnSummary {
  readonly id: string
  readonly status: string
  readonly reason: string
  readonly decisionReason: string | null
  readonly refundAmount: number
  readonly createdAt: string
}

/**
 * Resolve the return window for a product category.
 *
 * Keyed by category **name**, matched case-insensitively: `products.category`
 * is free text with an index but no foreign key to the `Category` table, so an
 * id-keyed lookup would match nothing and every product would silently fall
 * through to the default while appearing configured.
 */
const resolveCategoryWindow = (
  config: Awaited<ReturnType<typeof getReturnsConfig>>,
  category: string
): number | null => {
  const normalized = category.trim().toLowerCase()

  const excluded = config.nonReturnableCategoryNames.some(
    (name) => name.trim().toLowerCase() === normalized
  )
  if (excluded) return null

  const override = Object.entries(config.categoryWindowDays).find(
    ([name]) => name.trim().toLowerCase() === normalized
  )
  return override ? override[1] : config.defaultWindowDays
}

/** Rows for one order, with the product category each line belongs to. */
const loadOrderForReturn = async (orderId: string, userId: string) => {
  const order = await primaryDrizzleDb.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: { with: { product: { columns: { category: true, name: true } } } },
    },
  })

  // A return that belongs to somebody else is reported as missing rather than
  // forbidden, so the endpoint cannot be used to probe for valid identifiers.
  if (order?.userId !== userId) {
    throw new ReturnRequestError('Order not found', 404)
  }

  return order
}

/** Quantities already committed to a return, per order item. */
const loadHeldQuantities = async (
  orderId: string
): Promise<Map<string, number>> => {
  const rows = await primaryDrizzleDb
    .select({
      orderItemId: returnItems.orderItemId,
      quantity: returnItems.quantity,
    })
    .from(returnItems)
    .innerJoin(
      returnRequests,
      eq(returnItems.returnRequestId, returnRequests.id)
    )
    .where(
      and(
        eq(returnRequests.orderId, orderId),
        // A rejected claim releases its hold — those units become requestable
        // again. Every other status holds them.
        ne(returnRequests.status, 'REJECTED')
      )
    )

  const held = new Map<string, number>()
  for (const row of rows) {
    held.set(row.orderItemId, (held.get(row.orderItemId) ?? 0) + row.quantity)
  }
  return held
}

/**
 * What a customer may return from one order, and why not when they may not.
 *
 * The window is evaluated per item against its own category, so an item in a
 * non-returnable category is excluded individually rather than disqualifying
 * the whole order.
 */
export const getReturnEligibility = async (
  orderId: string,
  userId: string
): Promise<ReturnEligibility> => {
  const order = await loadOrderForReturn(orderId, userId)
  const config = await getReturnsConfig()
  const held = await loadHeldQuantities(orderId)
  const existing = await loadCustomerReturns(orderId)

  const items: ReturnEligibilityItem[] = order.items.map((item) => {
    const returnedQuantity = held.get(item.id) ?? 0
    return {
      orderItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.product?.name ?? 'Item',
      orderedQuantity: item.quantity,
      returnedQuantity,
      returnableQuantity: Math.max(0, item.quantity - returnedQuantity),
      unitPrice: item.price,
    }
  })

  if (order.status !== 'DELIVERED' || !order.deliveredAt) {
    return {
      isReturnable: false,
      reason: 'NOT_DELIVERED',
      deliveredAt: null,
      windowExpiresAt: null,
      items,
      returns: existing,
    }
  }

  // The order's window is the shortest of its items' windows, so a mixed
  // basket never grants a longer window than its strictest category allows.
  const windows = order.items
    .map((item) => resolveCategoryWindow(config, item.product?.category ?? ''))
    .filter((days): days is number => days !== null)

  if (windows.length === 0) {
    return {
      isReturnable: false,
      reason: 'CATEGORY_EXCLUDED',
      deliveredAt: order.deliveredAt.toISOString(),
      windowExpiresAt: null,
      items,
      returns: existing,
    }
  }

  const windowDays = Math.min(...windows)
  const expiresAt = new Date(
    order.deliveredAt.getTime() + windowDays * MILLISECONDS_PER_DAY
  )

  const reason: ReturnIneligibilityReason | null = (() => {
    if (expiresAt.getTime() < Date.now()) return 'WINDOW_EXPIRED'
    if (items.every((item) => item.returnableQuantity === 0)) {
      return 'FULLY_RETURNED'
    }
    return null
  })()

  return {
    isReturnable: reason === null,
    reason,
    deliveredAt: order.deliveredAt.toISOString(),
    windowExpiresAt: expiresAt.toISOString(),
    items,
    returns: existing,
  }
}

/** Claims already raised against an order, newest first. */
const loadCustomerReturns = async (
  orderId: string
): Promise<CustomerReturnSummary[]> => {
  const rows = await primaryDrizzleDb
    .select({
      id: returnRequests.id,
      status: returnRequests.status,
      reason: returnRequests.reason,
      decisionReason: returnRequests.decisionReason,
      refundAmount: returnRequests.refundAmount,
      createdAt: returnRequests.createdAt,
    })
    .from(returnRequests)
    .where(eq(returnRequests.orderId, orderId))

  // Newest first. An order carries a handful of claims at most, so sorting in
  // memory avoids a second index just for presentation order.
  return rows
    .map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export interface CreatedReturnRequest {
  readonly id: string
  readonly status: 'REQUESTED'
  readonly refundAmount: number
  readonly createdAt: string
}

/**
 * Record a damaged-item return claim.
 *
 * Everything is re-validated inside a transaction that locks the order row,
 * because eligibility computed before the lock is advisory only: two
 * submissions racing for the last returnable unit would both pass a check made
 * outside it.
 */
export const createReturnRequest = async (
  orderId: string,
  userId: string,
  input: CreateReturnRequestInput
): Promise<CreatedReturnRequest> => {
  const config = await getReturnsConfig()

  return primaryDrizzleDb.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        userId: orders.userId,
        status: orders.status,
        deliveredAt: orders.deliveredAt,
        subtotalAmount: orders.subtotalAmount,
        shippingAmount: orders.shippingAmount,
        taxAmount: orders.taxAmount,
        discountAmount: orders.discountAmount,
        amountPaid: orders.amountPaid,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for('update')

    if (order?.userId !== userId) {
      throw new ReturnRequestError('Order not found', 404)
    }

    if (order.status !== 'DELIVERED' || !order.deliveredAt) {
      throw new ReturnRequestError(
        'Only delivered orders can be returned',
        409,
        'NOT_DELIVERED'
      )
    }

    const lines = await tx
      .select({
        id: orderItems.id,
        variantId: orderItems.variantId,
        price: orderItems.price,
        quantity: orderItems.quantity,
        category: products.category,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId))

    const requestedIds = new Set(input.items.map((item) => item.orderItemId))
    const lineById = new Map(lines.map((line) => [line.id, line]))

    for (const id of requestedIds) {
      if (!lineById.has(id)) {
        throw new ReturnRequestError(`Item ${id} is not on this order`, 400)
      }
    }

    assertWithinWindow(config, lines, requestedIds, order.deliveredAt)
    const held = await assertQuantitiesAvailable(tx, orderId, input, lineById)

    const breakdown = calculateReturnRefund({
      order,
      items: lines.map((line) => ({
        orderItemId: line.id,
        price: line.price,
        quantity: line.quantity,
        alreadyReturned: held.get(line.id) ?? 0,
      })),
      requested: input.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
    })

    await assertWithinRefundableBalance(tx, order, breakdown.total)

    const [created] = await tx
      .insert(returnRequests)
      .values({
        orderId,
        userId,
        reason: input.reason as ReturnReason,
        customerNote: input.customerNote ?? null,
        refundAmount: breakdown.total,
      })
      .returning({ id: returnRequests.id, createdAt: returnRequests.createdAt })

    await tx.insert(returnItems).values(
      breakdown.items.map((line) => {
        const source = lineById.get(line.orderItemId)
        if (!source) {
          throw new ReturnRequestError(
            `Item ${line.orderItemId} is not on this order`,
            400
          )
        }
        return {
          returnRequestId: created.id,
          orderItemId: line.orderItemId,
          // Snapshotted so restock never has to re-resolve the variant inside
          // the transaction that holds the restock claim.
          variantId: source.variantId,
          quantity: line.quantity,
          refundableAmount: line.refundableAmount,
        }
      })
    )

    await attachEvidence(tx, created.id, orderId, userId, input.evidenceIds)

    logBusinessEvent({
      event: 'return_requested',
      details: {
        returnId: created.id,
        orderId,
        reason: input.reason,
        itemCount: breakdown.items.length,
        refundAmount: breakdown.total,
      },
      success: true,
    })

    return {
      id: created.id,
      status: 'REQUESTED' as const,
      refundAmount: breakdown.total,
      createdAt: created.createdAt.toISOString(),
    }
  })
}

type ReturnTransaction = Parameters<
  Parameters<typeof primaryDrizzleDb.transaction>[0]
>[0]

/** Every requested line must sit inside its own category's window. */
const assertWithinWindow = (
  config: Awaited<ReturnType<typeof getReturnsConfig>>,
  lines: ReadonlyArray<{ id: string; category: string }>,
  requestedIds: ReadonlySet<string>,
  deliveredAt: Date
): void => {
  for (const line of lines) {
    if (!requestedIds.has(line.id)) continue

    const windowDays = resolveCategoryWindow(config, line.category)
    if (windowDays === null) {
      throw new ReturnRequestError(
        'This item cannot be returned',
        409,
        'CATEGORY_EXCLUDED'
      )
    }

    const expiresAt = deliveredAt.getTime() + windowDays * MILLISECONDS_PER_DAY
    if (expiresAt < Date.now()) {
      throw new ReturnRequestError(
        'The return window for this order has expired',
        409,
        'WINDOW_EXPIRED'
      )
    }
  }
}

/**
 * Re-count held quantities under the order lock.
 *
 * Counting before the lock would let two concurrent submissions each see the
 * last unit as available.
 */
const assertQuantitiesAvailable = async (
  tx: ReturnTransaction,
  orderId: string,
  input: CreateReturnRequestInput,
  lineById: ReadonlyMap<string, { quantity: number }>
): Promise<ReadonlyMap<string, number>> => {
  const heldRows = await tx
    .select({
      orderItemId: returnItems.orderItemId,
      quantity: returnItems.quantity,
    })
    .from(returnItems)
    .innerJoin(
      returnRequests,
      eq(returnItems.returnRequestId, returnRequests.id)
    )
    .where(
      and(
        eq(returnRequests.orderId, orderId),
        ne(returnRequests.status, 'REJECTED')
      )
    )

  const held = new Map<string, number>()
  for (const row of heldRows) {
    held.set(row.orderItemId, (held.get(row.orderItemId) ?? 0) + row.quantity)
  }

  // Aggregate the request by line first. The schema rejects duplicates, but
  // checking each entry independently against the same `held` value would let
  // two entries for one line each pass on their own and together exceed the
  // quantity ordered — which the refund calculator would then price.
  const requestedByLine = new Map<string, number>()
  for (const item of input.items) {
    requestedByLine.set(
      item.orderItemId,
      (requestedByLine.get(item.orderItemId) ?? 0) + item.quantity
    )
  }

  for (const [orderItemId, quantity] of requestedByLine) {
    const line = lineById.get(orderItemId)
    if (!line) continue

    const available = line.quantity - (held.get(orderItemId) ?? 0)
    if (quantity > available) {
      throw new ReturnRequestError(
        `Only ${available} of this item can be returned`,
        409,
        'QUANTITY_EXCEEDED'
      )
    }
  }

  return held
}

/**
 * A return may never promise more than the order can still pay.
 *
 * Measured against the same ledger `refundOrder` reconciles against — the
 * `Refund` table — not only against other returns. A goodwill refund issued
 * from the admin panel consumes the same balance, and ignoring it would let a
 * claim be accepted, approved, and physically restocked before the refund step
 * discovers the money was never available.
 */
const assertWithinRefundableBalance = async (
  tx: ReturnTransaction,
  order: { id: string; amountPaid: number },
  requestedTotal: number
): Promise<void> => {
  const issued = await tx
    .select({ amount: refunds.amount })
    .from(refunds)
    .where(
      and(eq(refunds.orderId, order.id), ne(refunds.status, 'FAILED' as const))
    )

  // Claims that have not yet produced a Refund row. Those that have are
  // already counted above, so including them here would double-count.
  const openClaims = await tx
    .select({ refundAmount: returnRequests.refundAmount })
    .from(returnRequests)
    .where(
      and(
        eq(returnRequests.orderId, order.id),
        ne(returnRequests.status, 'REJECTED'),
        isNull(returnRequests.refundId)
      )
    )

  const committed = sumMoney([
    ...issued.map((row) => row.amount),
    ...openClaims.map((row) => row.refundAmount),
  ])

  if (roundMoney(committed + requestedTotal) > order.amountPaid) {
    throw new ReturnRequestError(
      'This return exceeds the amount paid for this order',
      409,
      'AMOUNT_EXCEEDED'
    )
  }
}

/**
 * Bind uploaded evidence to the new return.
 *
 * Only rows that are still orphaned **and** owned by this caller for this
 * order are attached. Ids that fail the filter are ignored rather than
 * rejected, so the endpoint cannot confirm whether an identifier exists — but
 * if nothing survives the filter the claim is rejected outright, because the
 * published policy requires evidence before a damage claim is reviewed.
 */
const attachEvidence = async (
  tx: ReturnTransaction,
  returnRequestId: string,
  orderId: string,
  userId: string,
  evidenceIds: readonly string[]
): Promise<void> => {
  const attached = await tx
    .update(returnEvidence)
    .set({ returnRequestId })
    .where(
      and(
        inArray(
          returnEvidence.id,
          [...evidenceIds].slice(0, RETURN_EVIDENCE_MAX)
        ),
        eq(returnEvidence.userId, userId),
        eq(returnEvidence.orderId, orderId),
        isNull(returnEvidence.returnRequestId)
      )
    )
    .returning({ id: returnEvidence.id })

  if (attached.length === 0) {
    throw new ReturnRequestError(
      'At least one photo of the damage is required',
      400
    )
  }
}

/** Count of a caller's still-unattached uploads for one order. */
export const countOrphanedEvidence = async (
  userId: string,
  orderId: string
): Promise<number> => {
  const [row] = await primaryDrizzleDb
    .select({ count: sql<number>`count(*)::int` })
    .from(returnEvidence)
    .where(
      and(
        eq(returnEvidence.userId, userId),
        eq(returnEvidence.orderId, orderId),
        isNull(returnEvidence.returnRequestId)
      )
    )

  return row?.count ?? 0
}
