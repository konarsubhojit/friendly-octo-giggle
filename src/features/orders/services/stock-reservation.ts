/**
 * The single owner of every stock reservation transition.
 *
 * A reservation is a hold on units of one variant for one checkout request. It
 * closes the window between stock *validation*, which happens when the request
 * is accepted, and stock *decrement*, which happens later inside the durable
 * order pipeline: without a hold two shoppers can both validate the last unit
 * and only one can be fulfilled.
 *
 * Three invariants make the whole feature provable by inspection:
 *
 * 1. **The database decides the winner.** A grant is one conditional
 *    `UPDATE ... WHERE stock - "reservedStock" >= q`; a zero-row result *is*
 *    the denial. No value is read beforehand and compared in JavaScript.
 * 2. **Every transition is a claim.** Consume, release and expire are
 *    `UPDATE ... WHERE status = 'HELD' RETURNING …`, so a replay claims
 *    nothing and adjusts nothing.
 * 3. **`reservedStock` moves only here.** Bounding the counter's mutations to
 *    one module is what bounds the drift risk the denormalisation buys.
 *
 * On-hand `ProductVariant.stock` is never touched by a reservation; it changes
 * only at order commit and restock.
 */

import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { productVariants, stockReservations } from '@/lib/schema'
import { logBusinessEvent } from '@/lib/logger'
import { recordStockReservationMetric } from '@/lib/metrics'
import type { OrderTransaction } from './order-restock'

/**
 * How long a hold survives without being consumed.
 *
 * Thirty minutes comfortably exceeds the worst-case online payment completion
 * window and is short enough that an abandoned checkout returns its units
 * within the same shopping session. Configurable so the value can follow a
 * payment provider that widens its window, rather than being a literal buried
 * in a query.
 */
export const RESERVATION_TTL_MINUTES = (() => {
  const raw = Number(process.env.RESERVATION_TTL_MINUTES)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30
})()

/**
 * Rows a single expiry sweep may claim.
 *
 * Bounded so a backlog cannot exhaust the function timeout; the cron runs
 * every thirty minutes, so a backlog drains rather than accumulating.
 */
export const RESERVATION_EXPIRY_BATCH_SIZE = 500

export interface ReservationItemInput {
  readonly variantId: string
  readonly quantity: number
}

export type ReservationGrantResult =
  | { readonly granted: true; readonly heldVariantIds: readonly string[] }
  | {
      readonly granted: false
      readonly unavailableVariantIds: readonly string[]
    }

/** A settled batch of holds: how many rows, and how many units they carried. */
export interface ReservationSettlement {
  readonly reservations: number
  readonly quantity: number
}

export interface CheckoutReservationSummary {
  readonly checkoutRequestId: string
  /** Live holds still counting against availability. */
  readonly heldQuantity: number
  /** Earliest expiry among the live holds; null when none are live. */
  readonly expiresAt: Date | null
  /** Terminal status shared by every row when nothing is live. */
  readonly status: 'HELD' | 'CONSUMED' | 'RELEASED' | 'EXPIRED' | 'MIXED'
}

/** Thrown inside the grant transaction to roll an all-or-nothing grant back. */
class ReservationDeniedError extends Error {
  readonly variantId: string

  constructor(variantId: string) {
    super(`Reservation denied for variant ${variantId}`)
    this.name = 'ReservationDeniedError'
    this.variantId = variantId
  }
}

/**
 * Merge duplicate line items and order them deterministically.
 *
 * Two concurrent multi-item checkouts that touch the same variants in opposite
 * order would deadlock on the row locks the conditional updates take; sorting
 * by variant id gives every transaction the same lock order. Merging matters
 * too — the same variant can appear twice in a cart with different
 * customization notes, and each occurrence must be held.
 */
const normalizeItems = (
  items: readonly ReservationItemInput[]
): ReservationItemInput[] => {
  const merged = new Map<string, number>()
  for (const item of items) {
    if (item.quantity <= 0) continue
    merged.set(
      item.variantId,
      (merged.get(item.variantId) ?? 0) + item.quantity
    )
  }
  return [...merged.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
}

/**
 * Give `quantity` units of a variant back to availability.
 *
 * Clamped at zero: a counter that has already drifted low must not be driven
 * negative by a correct release, and the check constraint would abort the
 * whole transaction if it were.
 */
const decrementReservedStock = (
  tx: OrderTransaction,
  variantId: string,
  quantity: number
) =>
  tx
    .update(productVariants)
    .set({
      reservedStock: sql`GREATEST(${productVariants.reservedStock} - ${quantity}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variantId))

/** Sum the claimed rows per variant so one update settles each variant once. */
const groupClaimedQuantities = (
  claimed: ReadonlyArray<{ variantId: string; quantity: number }>
): Array<{ variantId: string; quantity: number }> => {
  const totals = new Map<string, number>()
  for (const row of claimed) {
    totals.set(row.variantId, (totals.get(row.variantId) ?? 0) + row.quantity)
  }
  return [...totals.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
}

/**
 * Hold every requested unit, or none of them.
 *
 * All-or-nothing: the first item that cannot be held rolls the transaction
 * back, so a partially reserved checkout request cannot exist. The caller
 * turns the denial into a 409 naming the items, before any payment is
 * captured.
 *
 * Idempotent: `UNIQUE (checkoutRequestId, variantId)` means a replay finds the
 * existing `HELD` row and holds no additional units.
 */
export const reserveForCheckoutRequest = async ({
  checkoutRequestId,
  items,
}: {
  readonly checkoutRequestId: string
  readonly items: readonly ReservationItemInput[]
}): Promise<ReservationGrantResult> => {
  const normalized = normalizeItems(items)
  if (normalized.length === 0) {
    return { granted: true, heldVariantIds: [] }
  }

  try {
    const heldVariantIds = await primaryDrizzleDb.transaction(async (tx) => {
      const held: string[] = []

      for (const item of normalized) {
        const [existing] = await tx
          .select({
            id: stockReservations.id,
            status: stockReservations.status,
          })
          .from(stockReservations)
          .where(
            and(
              eq(stockReservations.checkoutRequestId, checkoutRequestId),
              eq(stockReservations.variantId, item.variantId)
            )
          )

        if (existing) {
          // A replay of an already-granted (or already-consumed) request holds
          // nothing further. A hold that has since been released or expired is
          // gone, and its units may have been sold to someone else, so the
          // request is denied rather than silently re-granted.
          if (existing.status === 'HELD' || existing.status === 'CONSUMED') {
            held.push(item.variantId)
            continue
          }
          throw new ReservationDeniedError(item.variantId)
        }

        // The database decides: this is the whole concurrency guarantee.
        const granted = await tx
          .update(productVariants)
          .set({
            reservedStock: sql`${productVariants.reservedStock} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              sql`${productVariants.deletedAt} IS NULL`,
              sql`${productVariants.stock} - ${productVariants.reservedStock} >= ${item.quantity}`
            )
          )
          .returning({ id: productVariants.id })

        if (granted.length === 0) {
          throw new ReservationDeniedError(item.variantId)
        }

        const inserted = await tx
          .insert(stockReservations)
          .values({
            checkoutRequestId,
            variantId: item.variantId,
            quantity: item.quantity,
            status: 'HELD',
            // Written from the database clock, so no instance clock ever
            // enters the expiry comparison.
            expiresAt: sql`now() + make_interval(mins => ${RESERVATION_TTL_MINUTES})`,
          })
          .onConflictDoNothing()
          .returning({ id: stockReservations.id })

        if (inserted.length === 0) {
          // A concurrent grant for the *same* checkout request won the unique
          // constraint. Its row is the hold; give back the units this attempt
          // just added so the counter still matches the ledger.
          await decrementReservedStock(tx, item.variantId, item.quantity)
        }

        held.push(item.variantId)
      }

      return held
    })

    recordStockReservationMetric('granted', heldVariantIds.length)
    logBusinessEvent({
      event: 'stock_reservation_granted',
      details: {
        checkoutRequestId,
        variantIds: heldVariantIds,
        ttlMinutes: RESERVATION_TTL_MINUTES,
      },
      success: true,
    })

    return { granted: true, heldVariantIds }
  } catch (error) {
    if (!(error instanceof ReservationDeniedError)) throw error

    recordStockReservationMetric('denied')
    logBusinessEvent({
      event: 'stock_reservation_denied',
      details: { checkoutRequestId, variantId: error.variantId },
      success: false,
    })

    return { granted: false, unavailableVariantIds: [error.variantId] }
  }
}

/**
 * Consume a request's holds inside the transaction that commits its order.
 *
 * Runs in the caller's transaction so "stock decremented", "order exists" and
 * "reservation consumed" either all happen or none do. The claim shape makes a
 * pipeline retry a no-op.
 *
 * @returns how many holds this call consumed.
 */
export const consumeForCheckoutRequest = async (
  tx: OrderTransaction,
  checkoutRequestId: string
): Promise<ReservationSettlement> => {
  const claimed = await tx
    .update(stockReservations)
    .set({ status: 'CONSUMED', settledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(stockReservations.checkoutRequestId, checkoutRequestId),
        eq(stockReservations.status, 'HELD')
      )
    )
    .returning({
      variantId: stockReservations.variantId,
      quantity: stockReservations.quantity,
    })

  const settlement = await settleClaimedRows(tx, claimed)
  if (settlement.reservations > 0) {
    recordStockReservationMetric('consumed', settlement.reservations)
  }
  return settlement
}

/** Decrement `reservedStock` for every claimed row and report the totals. */
const settleClaimedRows = async (
  tx: OrderTransaction,
  claimed: ReadonlyArray<{ variantId: string; quantity: number }>
): Promise<ReservationSettlement> => {
  const grouped = groupClaimedQuantities(claimed)
  for (const entry of grouped) {
    await decrementReservedStock(tx, entry.variantId, entry.quantity)
  }
  return {
    reservations: claimed.length,
    quantity: claimed.reduce((sum, row) => sum + row.quantity, 0),
  }
}

/**
 * Return a request's held units to availability.
 *
 * Called when a checkout request reaches `FAILED` — immediately, rather than
 * waiting for expiry — and from the admin release control. Repeating it claims
 * nothing.
 */
export const releaseForCheckoutRequest = async ({
  checkoutRequestId,
  reason,
}: {
  readonly checkoutRequestId: string
  readonly reason: string
}): Promise<ReservationSettlement> => {
  const settlement = await primaryDrizzleDb.transaction(async (tx) => {
    const claimed = await tx
      .update(stockReservations)
      .set({ status: 'RELEASED', settledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(stockReservations.checkoutRequestId, checkoutRequestId),
          eq(stockReservations.status, 'HELD')
        )
      )
      .returning({
        variantId: stockReservations.variantId,
        quantity: stockReservations.quantity,
      })

    return settleClaimedRows(tx, claimed)
  })

  if (settlement.reservations > 0) {
    recordStockReservationMetric('released', settlement.reservations)
    logBusinessEvent({
      event: 'stock_reservation_released',
      details: {
        checkoutRequestId,
        reason,
        reservations: settlement.reservations,
        quantity: settlement.quantity,
      },
      success: true,
    })
  }

  return settlement
}

/**
 * Release lapsed holds, bounded per run.
 *
 * Expiry is evaluated against the database clock (`now()`), never a JavaScript
 * `Date` computed on the instance, so clock skew between serverless instances
 * cannot expire a hold early.
 */
export const expireDueReservations = async (
  limit: number = RESERVATION_EXPIRY_BATCH_SIZE
): Promise<ReservationSettlement> => {
  const boundedLimit = Math.max(
    1,
    Math.min(Math.floor(limit), RESERVATION_EXPIRY_BATCH_SIZE)
  )

  const settlement = await primaryDrizzleDb.transaction(async (tx) => {
    const due = await tx
      .select({ id: stockReservations.id })
      .from(stockReservations)
      .where(
        and(
          eq(stockReservations.status, 'HELD'),
          lte(stockReservations.expiresAt, sql`now()`)
        )
      )
      .orderBy(asc(stockReservations.expiresAt))
      .limit(boundedLimit)

    if (due.length === 0) {
      return { reservations: 0, quantity: 0 }
    }

    const claimed = await tx
      .update(stockReservations)
      .set({ status: 'EXPIRED', settledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          inArray(
            stockReservations.id,
            due.map((row) => row.id)
          ),
          eq(stockReservations.status, 'HELD')
        )
      )
      .returning({
        variantId: stockReservations.variantId,
        quantity: stockReservations.quantity,
      })

    return settleClaimedRows(tx, claimed)
  })

  if (settlement.reservations > 0) {
    recordStockReservationMetric('expired', settlement.reservations)
    logBusinessEvent({
      event: 'stock_reservation_expired',
      details: {
        reservations: settlement.reservations,
        quantity: settlement.quantity,
      },
      success: true,
    })
  }

  return settlement
}

/**
 * Summarise reservations for a set of checkout requests in one query.
 *
 * The admin dashboard renders up to 50 requests; a per-row lookup would make
 * that 50 round trips.
 */
export const getReservationsForCheckoutRequests = async (
  checkoutRequestIds: readonly string[]
): Promise<Map<string, CheckoutReservationSummary>> => {
  const summaries = new Map<string, CheckoutReservationSummary>()
  if (checkoutRequestIds.length === 0) return summaries

  const rows = await primaryDrizzleDb
    .select({
      checkoutRequestId: stockReservations.checkoutRequestId,
      quantity: stockReservations.quantity,
      status: stockReservations.status,
      expiresAt: stockReservations.expiresAt,
    })
    .from(stockReservations)
    .where(
      inArray(stockReservations.checkoutRequestId, [...checkoutRequestIds])
    )

  for (const row of rows) {
    const current = summaries.get(row.checkoutRequestId)
    const isHeld = row.status === 'HELD'
    const expiresAt = isHeld ? new Date(row.expiresAt) : null

    if (!current) {
      summaries.set(row.checkoutRequestId, {
        checkoutRequestId: row.checkoutRequestId,
        heldQuantity: isHeld ? row.quantity : 0,
        expiresAt,
        status: row.status,
      })
      continue
    }

    summaries.set(row.checkoutRequestId, {
      checkoutRequestId: row.checkoutRequestId,
      heldQuantity: current.heldQuantity + (isHeld ? row.quantity : 0),
      expiresAt: earliest(current.expiresAt, expiresAt),
      status: current.status === row.status ? current.status : 'MIXED',
    })
  }

  return summaries
}

const earliest = (a: Date | null, b: Date | null): Date | null => {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

/**
 * Units a single checkout request is holding, per variant.
 *
 * Order validation runs *for* a request that already owns a hold, so plain
 * `stock - reservedStock` would count that request's own units against it and
 * reject every legitimate order. Callers add these back to get the quantity
 * genuinely available to this request. `CONSUMED` rows are excluded: their
 * units have already left `reservedStock` and `stock` alike.
 */
export const getHeldQuantitiesForCheckoutRequest = async (
  checkoutRequestId: string
): Promise<Map<string, number>> => {
  const rows = await primaryDrizzleDb
    .select({
      variantId: stockReservations.variantId,
      quantity: stockReservations.quantity,
    })
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.checkoutRequestId, checkoutRequestId),
        eq(stockReservations.status, 'HELD')
      )
    )

  const held = new Map<string, number>()
  for (const row of rows) {
    held.set(row.variantId, (held.get(row.variantId) ?? 0) + row.quantity)
  }
  return held
}
