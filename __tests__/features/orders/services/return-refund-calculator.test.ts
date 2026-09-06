import { describe, expect, it } from 'vitest'
import { calculateReturnRefund } from '@/features/orders/services/return-refund-calculator'
import { sumMoney } from '@/lib/money'

const order = {
  subtotalAmount: 1000,
  shippingAmount: 50,
  taxAmount: 100,
  discountAmount: 0,
}

const items = [
  { orderItemId: 'aaaaaaa', price: 400, quantity: 1 },
  { orderItemId: 'bbbbbbb', price: 300, quantity: 2 },
]

describe('calculateReturnRefund', () => {
  it('refunds the line price and its tax share for a partial return', () => {
    const result = calculateReturnRefund({
      order,
      items,
      requested: [{ orderItemId: 'aaaaaaa', quantity: 1 }],
    })

    // 400 of a 1000 subtotal is 40% of the order, so 40% of the 100 tax.
    expect(result.items[0].refundableAmount).toBe(440)
    expect(result.shippingRefund).toBe(0)
    expect(result.total).toBe(440)
  })

  it('refunds shipping only when every unit is returned', () => {
    const partial = calculateReturnRefund({
      order,
      items,
      requested: [{ orderItemId: 'bbbbbbb', quantity: 1 }],
    })
    expect(partial.isFullReturn).toBe(false)
    expect(partial.shippingRefund).toBe(0)

    const full = calculateReturnRefund({
      order,
      items,
      requested: [
        { orderItemId: 'aaaaaaa', quantity: 1 },
        { orderItemId: 'bbbbbbb', quantity: 2 },
      ],
    })
    expect(full.isFullReturn).toBe(true)
    expect(full.shippingRefund).toBe(50)
    // Whole order back: subtotal + shipping + tax.
    expect(full.total).toBe(1150)
  })

  it('deducts the returned share of an order-level discount', () => {
    const discounted = {
      subtotalAmount: 1000,
      shippingAmount: 0,
      taxAmount: 0,
      discountAmount: 100,
    }

    const result = calculateReturnRefund({
      order: discounted,
      items,
      requested: [{ orderItemId: 'aaaaaaa', quantity: 1 }],
    })

    // 400 gross less its 40 share of the 100 discount.
    expect(result.items[0].refundableAmount).toBe(360)
  })

  it('reconciles a full return exactly against the captured total', () => {
    const discounted = {
      subtotalAmount: 1000,
      shippingAmount: 50,
      taxAmount: 100,
      discountAmount: 100,
    }

    const result = calculateReturnRefund({
      order: discounted,
      items,
      requested: [
        { orderItemId: 'aaaaaaa', quantity: 1 },
        { orderItemId: 'bbbbbbb', quantity: 2 },
      ],
    })

    // Nothing may be lost or invented: the full return must equal exactly what
    // the customer paid.
    const captured =
      discounted.subtotalAmount +
      discounted.shippingAmount +
      discounted.taxAmount -
      discounted.discountAmount
    expect(result.total).toBe(captured)
  })

  it('never loses a paisa when a discount does not divide evenly', () => {
    const awkward = {
      subtotalAmount: 30,
      shippingAmount: 0,
      taxAmount: 0,
      discountAmount: 10,
    }
    const threeLines = [
      { orderItemId: 'aaaaaaa', price: 10, quantity: 1 },
      { orderItemId: 'bbbbbbb', price: 10, quantity: 1 },
      { orderItemId: 'ccccccc', price: 10, quantity: 1 },
    ]

    const result = calculateReturnRefund({
      order: awkward,
      items: threeLines,
      requested: [
        { orderItemId: 'aaaaaaa', quantity: 1 },
        { orderItemId: 'bbbbbbb', quantity: 1 },
        { orderItemId: 'ccccccc', quantity: 1 },
      ],
    })

    // Naive per-line rounding gives 3 × 6.67 = 20.01, over-refunding by a paisa.
    expect(result.total).toBe(20)
    expect(sumMoney(result.items.map((item) => item.refundableAmount))).toBe(20)
  })

  it('prorates a partly returned line by unit', () => {
    const result = calculateReturnRefund({
      order,
      items,
      requested: [{ orderItemId: 'bbbbbbb', quantity: 1 }],
    })

    // One of two units at 300 each; 300/1000 of the 100 tax.
    expect(result.items[0].refundableAmount).toBe(330)
  })

  it('carries the snapshot quantity through to the result', () => {
    const result = calculateReturnRefund({
      order,
      items,
      requested: [{ orderItemId: 'bbbbbbb', quantity: 2 }],
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      orderItemId: 'bbbbbbb',
      quantity: 2,
    })
  })

  it('rejects a requested item that is not on the order', () => {
    expect(() =>
      calculateReturnRefund({
        order,
        items,
        requested: [{ orderItemId: 'zzzzzzz', quantity: 1 }],
      })
    ).toThrow(/not on this order/i)
  })

  it('rejects a quantity greater than the line quantity', () => {
    expect(() =>
      calculateReturnRefund({
        order,
        items,
        requested: [{ orderItemId: 'aaaaaaa', quantity: 2 }],
      })
    ).toThrow(/exceeds/i)
  })

  it('rejects an empty request', () => {
    expect(() =>
      calculateReturnRefund({ order, items, requested: [] })
    ).toThrow(/at least one item/i)
  })

  it('handles a zero-subtotal order without dividing by zero', () => {
    const free = {
      subtotalAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
    }
    const freeItems = [{ orderItemId: 'aaaaaaa', price: 0, quantity: 1 }]

    const result = calculateReturnRefund({
      order: free,
      items: freeItems,
      requested: [{ orderItemId: 'aaaaaaa', quantity: 1 }],
    })

    expect(result.total).toBe(0)
    expect(result.items[0].refundableAmount).toBe(0)
  })
})
