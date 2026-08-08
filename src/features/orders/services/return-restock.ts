import { and, eq, isNull, sql } from 'drizzle-orm'
import { returnRequests, productVariants } from '@/lib/schema'
import type { OrderTransaction } from './order-restock'

export interface RestockableReturn {
  readonly id: string
  readonly items: ReadonlyArray<{
    readonly variantId: string
    readonly quantity: number
  }>
}

/**
 * Return the units from one return request to inventory exactly once.
 *
 * A deliberate sibling of `restockOrderItems` rather than a reuse of it. That
 * function claims `Order.stockRestoredAt`, a single order-level flag: calling
 * it for a return would consume the order's one claim and permanently block
 * any later restock for that order — including a second return against the
 * same order. Returns need a per-return claim, so this guards
 * `ReturnRequest.stockRestoredAt` with the identical conditional-update idiom.
 *
 * Only `stock` is credited. `reservedStock` is the sum of live checkout holds
 * and is none of this operation's business: incrementing on-hand stock alone
 * makes the returned units available without disturbing any reservation.
 *
 * Soft-deleted variants are restocked like any other. The units physically
 * exist and must be counted; whether the variant is still sellable is a
 * merchandising question, not an inventory one.
 *
 * @returns true when this call performed the restock.
 */
export const restockReturnItems = async (
  tx: OrderTransaction,
  returnRequest: RestockableReturn
): Promise<boolean> => {
  const claimed = await tx
    .update(returnRequests)
    .set({ stockRestoredAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(returnRequests.id, returnRequest.id),
        isNull(returnRequests.stockRestoredAt)
      )
    )
    .returning({ id: returnRequests.id })

  if (claimed.length === 0) {
    return false
  }

  await Promise.all(
    returnRequest.items.map((item) =>
      tx
        .update(productVariants)
        .set({
          stock: sql`${productVariants.stock} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, item.variantId))
    )
  )

  return true
}
