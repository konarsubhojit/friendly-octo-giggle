import { describe, it, expect } from 'vitest'
import {
  calculateOrderTotals,
  calculateSubtotal,
} from '@/features/orders/services/order-pricing'
import { sumMoney } from '@/lib/money'

describe('calculateSubtotal', () => {
  it('multiplies each line without floating point drift', () => {
    expect(
      calculateSubtotal([
        { price: 10.1, quantity: 3 },
        { price: 0.2, quantity: 1 },
      ])
    ).toBe(30.5)
  })
})

describe('calculateOrderTotals', () => {
  const destination = { state: 'Delhi', pinCode: '110001' }

  it('reconciles subtotal, shipping and tax into the grand total', () => {
    const totals = calculateOrderTotals({
      items: [{ price: 100, quantity: 1, weightGrams: 250 }],
      destination,
    })

    expect(totals.subtotal).toBe(100)
    expect(totals.shipping.amount).toBe(69)
    expect(totals.tax.amount).toBe(8.45)
    expect(totals.total).toBe(177.45)
    expect(totals.total).toBe(
      sumMoney([totals.subtotal, totals.shipping.amount, totals.tax.amount])
    )
  })

  it('applies the selected shipping method', () => {
    const express = calculateOrderTotals({
      items: [{ price: 100, quantity: 1 }],
      destination,
      shippingMethod: 'EXPRESS',
    })

    expect(express.shipping.method).toBe('EXPRESS')
    expect(express.shipping.amount).toBeGreaterThan(69)
  })

  it('taxes only the merchandise once shipping is free', () => {
    const totals = calculateOrderTotals({
      items: [{ price: 2000, quantity: 1 }],
      destination,
    })

    expect(totals.shipping.amount).toBe(0)
    expect(totals.tax.amount).toBe(100)
    expect(totals.total).toBe(2100)
  })

  it('charges local delivery less than a national one', () => {
    const local = calculateOrderTotals({
      items: [{ price: 100, quantity: 1 }],
      destination: { state: 'West Bengal', pinCode: '700001' },
    })

    expect(local.shipping.zone).toBe('LOCAL')
    expect(local.shipping.amount).toBeLessThan(69)
  })
})
