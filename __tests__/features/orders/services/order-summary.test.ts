import { describe, it, expect } from 'vitest'
import {
  summarizeOrderProducts,
  countOrderUnits,
  buildCheckoutSummaryLineItems,
  buildCheckoutPricingSummary,
  buildCheckoutPricingSummaryFromLineItems,
} from '@/features/orders/services/order-summary'

describe('order-summary', () => {
  describe('summarizeOrderProducts', () => {
    it('returns fallback text for empty items', () => {
      expect(summarizeOrderProducts([])).toBe('Order items unavailable')
    })

    it('returns fallback when items have no product names', () => {
      const items = [
        { quantity: 1, product: null },
        { quantity: 2, product: undefined },
      ]
      expect(summarizeOrderProducts(items)).toBe('Order items unavailable')
    })

    it('returns single product name', () => {
      const items = [{ quantity: 1, product: { name: 'Widget' } }]
      expect(summarizeOrderProducts(items)).toBe('Widget')
    })

    it('returns two product names joined by comma', () => {
      const items = [
        { quantity: 1, product: { name: 'Widget' } },
        { quantity: 2, product: { name: 'Gadget' } },
      ]
      expect(summarizeOrderProducts(items)).toBe('Widget, Gadget')
    })

    it('shows remaining count for more than 2 products', () => {
      const items = [
        { quantity: 1, product: { name: 'Widget' } },
        { quantity: 1, product: { name: 'Gadget' } },
        { quantity: 1, product: { name: 'Gizmo' } },
      ]
      expect(summarizeOrderProducts(items)).toBe('Widget, Gadget and 1 more')
    })

    it('deduplicates product names', () => {
      const items = [
        { quantity: 1, product: { name: 'Widget' } },
        { quantity: 2, product: { name: 'Widget' } },
        { quantity: 1, product: { name: 'Gadget' } },
      ]
      expect(summarizeOrderProducts(items)).toBe('Widget, Gadget')
    })

    it('respects custom maxVisibleNames', () => {
      const items = [
        { quantity: 1, product: { name: 'A' } },
        { quantity: 1, product: { name: 'B' } },
        { quantity: 1, product: { name: 'C' } },
        { quantity: 1, product: { name: 'D' } },
      ]
      expect(summarizeOrderProducts(items, 3)).toBe('A, B, C and 1 more')
    })

    it('ensures at least 1 visible name even with maxVisibleNames=0', () => {
      const items = [
        { quantity: 1, product: { name: 'A' } },
        { quantity: 1, product: { name: 'B' } },
      ]
      expect(summarizeOrderProducts(items, 0)).toBe('A and 1 more')
    })

    it('trims whitespace from names', () => {
      const items = [{ quantity: 1, product: { name: '  Widget  ' } }]
      expect(summarizeOrderProducts(items)).toBe('Widget')
    })

    it('filters out empty/blank product names', () => {
      const items = [
        { quantity: 1, product: { name: '' } },
        { quantity: 1, product: { name: '  ' } },
        { quantity: 1, product: { name: 'Widget' } },
      ]
      expect(summarizeOrderProducts(items)).toBe('Widget')
    })
  })

  describe('countOrderUnits', () => {
    it('returns 0 for empty items', () => {
      expect(countOrderUnits([])).toBe(0)
    })

    it('sums quantities', () => {
      const items = [{ quantity: 3 }, { quantity: 5 }, { quantity: 2 }]
      expect(countOrderUnits(items)).toBe(10)
    })

    it('handles missing quantity', () => {
      const items = [{ quantity: 3 }, {} as { quantity?: number }]
      expect(countOrderUnits(items)).toBe(3)
    })
  })

  describe('buildCheckoutSummaryLineItems', () => {
    it('returns empty array for no items', () => {
      expect(buildCheckoutSummaryLineItems([])).toEqual([])
    })

    it('builds line item with product price', () => {
      const items = [
        {
          quantity: 2,
          product: { price: 100, name: 'Widget' },
          variation: null,
          customizationNote: null,
        },
      ]

      const result = buildCheckoutSummaryLineItems(items)

      expect(result).toEqual([
        {
          name: 'Widget',
          variationLabel: null,
          quantity: 2,
          unitPrice: 100,
          lineTotal: 200,
          customizationNote: null,
        },
      ])
    })

    it('uses variation price when variation exists', () => {
      const items = [
        {
          quantity: 1,
          product: { price: 100, name: 'Widget' },
          variation: { name: 'Large', designName: null, price: 150 },
          customizationNote: 'Custom text',
        },
      ]

      const result = buildCheckoutSummaryLineItems(items)

      expect(result[0].unitPrice).toBe(150)
      expect(result[0].lineTotal).toBe(150)
      expect(result[0].variationLabel).toBe('Large')
      expect(result[0].customizationNote).toBe('Custom text')
    })

    it('includes designName in variation label', () => {
      const items = [
        {
          quantity: 1,
          product: { price: 100, name: 'Widget' },
          variation: { name: 'Blue', designName: 'Ocean', price: 120 },
        },
      ]

      const result = buildCheckoutSummaryLineItems(items)

      expect(result[0].variationLabel).toBe('Blue - Ocean')
    })

    it('deduplicates variation name and designName when same', () => {
      const items = [
        {
          quantity: 1,
          product: { price: 100, name: 'Widget' },
          variation: { name: 'Blue', designName: 'Blue', price: 120 },
        },
      ]

      const result = buildCheckoutSummaryLineItems(items)

      expect(result[0].variationLabel).toBe('Blue')
    })

    it('handles missing product', () => {
      const items = [
        {
          quantity: 3,
          product: null,
          variation: null,
        },
      ]

      const result = buildCheckoutSummaryLineItems(items)

      expect(result[0].name).toBe('Product unavailable')
      expect(result[0].unitPrice).toBe(0)
      expect(result[0].lineTotal).toBe(0)
    })

    it('handles missing quantity', () => {
      const items = [
        {
          product: { price: 50, name: 'Item' },
          variation: null,
        },
      ]

      const result = buildCheckoutSummaryLineItems(items)

      expect(result[0].quantity).toBe(0)
      expect(result[0].lineTotal).toBe(0)
    })
  })

  describe('buildCheckoutPricingSummary', () => {
    it('returns zero summary for empty items', () => {
      const result = buildCheckoutPricingSummary([])

      expect(result).toEqual({
        itemCount: 0,
        subtotal: 0,
        shippingAmount: 0,
        total: 0,
      })
    })

    it('calculates correct totals', () => {
      const items = [
        {
          quantity: 2,
          product: { price: 100, name: 'A' },
          variation: null,
        },
        {
          quantity: 3,
          product: { price: 50, name: 'B' },
          variation: null,
        },
      ]

      const result = buildCheckoutPricingSummary(items)

      expect(result.itemCount).toBe(5)
      expect(result.subtotal).toBe(350)
      expect(result.shippingAmount).toBe(0)
      expect(result.total).toBe(350)
    })

    it('uses variation prices in total', () => {
      const items = [
        {
          quantity: 1,
          product: { price: 100, name: 'A' },
          variation: { name: 'XL', designName: null, price: 120 },
        },
      ]

      const result = buildCheckoutPricingSummary(items)

      expect(result.subtotal).toBe(120)
      expect(result.total).toBe(120)
    })
  })

  describe('buildCheckoutPricingSummaryFromLineItems', () => {
    it('returns zero summary for empty line items', () => {
      const result = buildCheckoutPricingSummaryFromLineItems([])

      expect(result).toEqual({
        itemCount: 0,
        subtotal: 0,
        shippingAmount: 0,
        total: 0,
      })
    })

    it('aggregates from pre-built line items', () => {
      const lineItems = [
        {
          name: 'Widget',
          variationLabel: null,
          quantity: 2,
          unitPrice: 100,
          lineTotal: 200,
          customizationNote: null,
        },
        {
          name: 'Gadget',
          variationLabel: 'Blue',
          quantity: 1,
          unitPrice: 50,
          lineTotal: 50,
          customizationNote: null,
        },
      ]

      const result = buildCheckoutPricingSummaryFromLineItems(lineItems)

      expect(result.itemCount).toBe(3)
      expect(result.subtotal).toBe(250)
      expect(result.total).toBe(250)
      expect(result.shippingAmount).toBe(0)
    })
  })
})
