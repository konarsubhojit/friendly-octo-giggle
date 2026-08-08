import { asc, inArray } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { returnEvidence, returnItems } from '@/lib/schema'

interface QueueRow {
  readonly id: string
  readonly createdAt: Date
}

/**
 * Attach the line items and damage photos an operator needs to decide.
 *
 * Without these the admin card's evidence gallery and item list render nothing
 * — both fields are optional on `AdminReturn`, so the omission is silent — and
 * every approve/reject is made without seeing the damage the claim is about.
 *
 * Two batched queries keyed on the page's ids, so the cost does not scale with
 * page size.
 */
export const withItemsAndEvidence = async <Row extends QueueRow>(
  page: readonly Row[]
) => {
  if (page.length === 0) return []

  const ids = page.map((row) => row.id)

  const [itemRows, evidenceRows] = await Promise.all([
    primaryDrizzleDb
      .select({
        returnRequestId: returnItems.returnRequestId,
        orderItemId: returnItems.orderItemId,
        quantity: returnItems.quantity,
        refundableAmount: returnItems.refundableAmount,
      })
      .from(returnItems)
      .where(inArray(returnItems.returnRequestId, ids)),
    primaryDrizzleDb
      .select({
        returnRequestId: returnEvidence.returnRequestId,
        id: returnEvidence.id,
        url: returnEvidence.url,
      })
      .from(returnEvidence)
      .where(inArray(returnEvidence.returnRequestId, ids))
      .orderBy(asc(returnEvidence.createdAt)),
  ])

  return page.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    items: itemRows
      .filter((item) => item.returnRequestId === row.id)
      .map(({ orderItemId, quantity, refundableAmount }) => ({
        orderItemId,
        quantity,
        refundableAmount,
      })),
    evidence: evidenceRows
      .filter((item) => item.returnRequestId === row.id)
      .map(({ id, url }) => ({ id, url })),
  }))
}
