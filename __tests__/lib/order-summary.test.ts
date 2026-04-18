import { describe, expect, it } from 'vitest'
import {
  buildCheckoutPricingSummary,
  buildCheckoutPricingSummaryFromLineItems,
  buildCheckoutSummaryLineItems,
  countOrderUnits,
  summarizeOrderProducts,
} from '@/features/orders/services/order-summary'

describe('order-summary', () => {
  it('summarizes unique product names and counts hidden products', () => {
    expect(
      summarizeOrderProducts([
        { quantity: 1, product: { name: 'Rose Box' } },
        { quantity: 2, product: { name: 'Lily Vase' } },
        { quantity: 1, product: { name: 'Rose Box' } },
        { quantity: 1, product: { name: 'Tulip Candle' } },
      ])
    ).toBe('Rose Box, Lily Vase and 1 more')
  })

  it('counts order units across all items', () => {
    expect(
      countOrderUnits([
        { quantity: 2, product: { name: 'Rose Box' } },
        { quantity: 3, product: { name: 'Lily Vase' } },
      ])
    ).toBe(5)
  })

  it('builds checkout line items with variant labels and customization notes', () => {
    expect(
      buildCheckoutSummaryLineItems([
        {
          quantity: 2,
          product: { name: 'Rose Box' },
          variant: {
            name: 'Large',
            sku: 'Ruby',
            price: 1250,
          },
          customizationNote: 'Add ribbon',
        },
      ])
    ).toEqual([
      {
        name: 'Rose Box',
        variantLabel: 'Large - Ruby',
        quantity: 2,
        unitPrice: 1250,
        lineTotal: 2500,
        customizationNote: 'Add ribbon',
      },
    ])
  })

  it('builds the same pricing summary from raw items and derived line items', () => {
    const rawItems = [
      {
        quantity: 2,
        product: { name: 'Rose Box' },
        variant: { name: 'Large', sku: null, price: 1250 },
        customizationNote: null,
      },
      {
        quantity: 1,
        product: { name: 'Lily Vase' },
        variant: { name: undefined, sku: null, price: 800 },
        customizationNote: null,
      },
    ] as const

    const lineItems = buildCheckoutSummaryLineItems(rawItems)

    expect(buildCheckoutPricingSummary(rawItems)).toEqual({
      itemCount: 3,
      subtotal: 3300,
      shippingAmount: 0,
      total: 3300,
    })
    expect(buildCheckoutPricingSummaryFromLineItems(lineItems)).toEqual(
      buildCheckoutPricingSummary(rawItems)
    )
  })
})
