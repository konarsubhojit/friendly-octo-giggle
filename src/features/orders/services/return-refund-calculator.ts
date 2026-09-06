import { allocateMoney, multiplyMoney, roundMoney, sumMoney } from '@/lib/money'

/** The order-level amounts a refund is computed against. */
export interface ReturnRefundOrder {
  readonly subtotalAmount: number
  readonly shippingAmount: number
  readonly taxAmount: number
  readonly discountAmount: number
}

/** One line on the order, as sold. */
export interface ReturnRefundOrderItem {
  readonly orderItemId: string
  readonly price: number
  readonly quantity: number
  /**
   * Units of this line already committed to earlier returns.
   *
   * Required for conservation across a sequence of partial returns.
   * `allocateMoney` puts the leftover minor units on the lowest indices, so
   * always starting at unit 0 would hand every partial return the same "fat"
   * unit — losing or inventing paise against a single combined return.
   */
  readonly alreadyReturned?: number
}

/** A quantity the customer wants to send back. */
export interface ReturnRefundRequestItem {
  readonly orderItemId: string
  readonly quantity: number
}

export interface ReturnRefundLine {
  readonly orderItemId: string
  readonly quantity: number
  /** Frozen at request time and persisted on `ReturnItem`. */
  readonly refundableAmount: number
}

export interface ReturnRefundBreakdown {
  readonly items: readonly ReturnRefundLine[]
  readonly shippingRefund: number
  readonly total: number
  readonly isFullReturn: boolean
}

export interface CalculateReturnRefundInput {
  readonly order: ReturnRefundOrder
  readonly items: readonly ReturnRefundOrderItem[]
  readonly requested: readonly ReturnRefundRequestItem[]
}

/**
 * Compute what a return is worth.
 *
 * Two rules govern the result, both fixed by the specification:
 *
 * 1. **Discount and tax follow the goods.** Each returned unit carries its
 *    proportional share of the order-level discount and tax, allocated with
 *    `allocateMoney` so the parts sum back exactly. Rounding each line
 *    independently would lose or invent paise and break reconciliation against
 *    the amount originally captured.
 * 2. **Shipping is refunded only on a full return.** A single delivery cannot
 *    be sensibly apportioned across partial returns, and this guarantees the
 *    sum of all partial refunds for an order can never exceed what was
 *    captured — shipping and its tax are refunded at most once.
 *
 * Pure: no I/O, no clock, no database. The caller persists the result.
 */
export const calculateReturnRefund = ({
  order,
  items,
  requested,
}: CalculateReturnRefundInput): ReturnRefundBreakdown => {
  if (requested.length === 0) {
    throw new Error('A return must include at least one item')
  }

  // Keep the line index with the item. The discount/tax arrays use `items`
  // order, so looking the index up with `items.indexOf(item)` for every
  // requested line would repeatedly scan the order lines.
  const byId = new Map(
    items.map((item, index) => [item.orderItemId, { item, index }])
  )

  // Gross value of every line on the order, in the same order as `items`, so
  // the allocation weights line up with the lines they belong to.
  const lineGross = items.map((item) =>
    multiplyMoney(item.price, item.quantity)
  )

  // Order-level amounts split across lines by gross value. Both are allocated
  // over the whole order, then taken pro rata for the units being returned —
  // allocating only across returned lines would hand a partial return the
  // whole discount.
  const discountByLine = allocateMoney(order.discountAmount, lineGross)
  const taxByLine = allocateMoney(order.taxAmount, lineGross)

  const lines = requested.map((request) => {
    const indexedItem = byId.get(request.orderItemId)
    if (!indexedItem) {
      throw new Error(`Order item ${request.orderItemId} is not on this order`)
    }
    const { item, index } = indexedItem
    if (request.quantity > item.quantity) {
      throw new Error(
        `Requested quantity ${request.quantity} exceeds the ${item.quantity} ordered for ${request.orderItemId}`
      )
    }

    const alreadyReturned = item.alreadyReturned ?? 0
    if (alreadyReturned + request.quantity > item.quantity) {
      throw new Error(
        `Requested quantity ${request.quantity} exceeds the ${item.quantity - alreadyReturned} still returnable for ${request.orderItemId}`
      )
    }

    // Split each line's discount and tax across its own units, so returning
    // 1 of 3 takes exactly one unit's share and the remainder rule still
    // conserves the total.
    const unitDiscount = allocateMoney(discountByLine[index], unitWeights(item))
    const unitTax = allocateMoney(taxByLine[index], unitWeights(item))

    // Take the units after the ones earlier returns already consumed, so the
    // sum across every partial return equals one combined return exactly.
    const returnedUnits = Array.from(
      { length: request.quantity },
      (_unused, offset) => alreadyReturned + offset
    )

    const gross = multiplyMoney(item.price, request.quantity)
    const discountShare = sumMoney(
      returnedUnits.map((unit) => unitDiscount[unit])
    )
    const taxShare = sumMoney(returnedUnits.map((unit) => unitTax[unit]))

    return {
      orderItemId: item.orderItemId,
      quantity: request.quantity,
      refundableAmount: roundMoney(gross - discountShare + taxShare),
    }
  })

  const isFullReturn = items.every((item) => {
    const match = requested.find(
      (request) => request.orderItemId === item.orderItemId
    )
    return match?.quantity === item.quantity
  })

  const shippingRefund = isFullReturn ? roundMoney(order.shippingAmount) : 0

  return {
    items: lines,
    shippingRefund,
    total: sumMoney([
      ...lines.map((line) => line.refundableAmount),
      shippingRefund,
    ]),
    isFullReturn,
  }
}

/** Equal weight per unit, so a line's share divides evenly across its units. */
const unitWeights = (item: ReturnRefundOrderItem): number[] =>
  Array.from({ length: item.quantity }, () => 1)
