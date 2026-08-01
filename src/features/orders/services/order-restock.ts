import { and, eq, isNull, sql } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { orders, productVariants } from '@/lib/schema'

/** The transaction handle passed to `primaryDrizzleDb.transaction` callbacks. */
export type OrderTransaction = Parameters<
  Parameters<typeof primaryDrizzleDb.transaction>[0]
>[0]

export interface RestockableOrder {
  readonly id: string
  readonly items: ReadonlyArray<{
    readonly variantId: string
    readonly quantity: number
  }>
}

/**
 * Return an order's items to inventory exactly once.
 *
 * Cancellations and refunds can both credit stock, and an order can be
 * cancelled and then refunded (or refunded concurrently by an admin and a
 * webhook). `Order.stockRestoredAt` is claimed with a conditional update inside
 * the caller's transaction, so only the first claimant credits the variants —
 * every later attempt is a no-op.
 *
 * @returns true when this call performed the restock.
 */
export const restockOrderItems = async (
  tx: OrderTransaction,
  order: RestockableOrder
): Promise<boolean> => {
  const claimed = await tx
    .update(orders)
    .set({ stockRestoredAt: new Date(), updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), isNull(orders.stockRestoredAt)))
    .returning({ id: orders.id })

  if (claimed.length === 0) {
    return false
  }

  await Promise.all(
    order.items.map((item) =>
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
