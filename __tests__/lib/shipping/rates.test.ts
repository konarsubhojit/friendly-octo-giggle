import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ITEM_WEIGHT_GRAMS,
  SHIPPING_ZONE_RATES,
  calculateShipmentWeight,
  countWeightBands,
  quoteShipping,
} from '@/lib/shipping/rates'
import { resolveShippingZone } from '@/lib/shipping/zones'
import {
  buildShippingMethodOptions,
  quoteAllShippingMethods,
} from '@/lib/shipping'

describe('resolveShippingZone', () => {
  it('prices the origin state as local', () => {
    expect(
      resolveShippingZone({ state: 'West Bengal', pinCode: '700001' })
    ).toBe('LOCAL')
  })

  it('normalises casing, punctuation and spacing', () => {
    expect(resolveShippingZone({ state: '  west   bengal ' })).toBe('LOCAL')
    expect(resolveShippingZone({ state: 'Jammu & Kashmir' })).toBe('REMOTE')
  })

  it('resolves neighbouring states as regional', () => {
    expect(resolveShippingZone({ state: 'Bihar' })).toBe('REGIONAL')
  })

  it('resolves other states as national', () => {
    expect(resolveShippingZone({ state: 'Delhi' })).toBe('NATIONAL')
  })

  it('detects remote circles from the pin code when the state is missing', () => {
    expect(resolveShippingZone({ state: '', pinCode: '744101' })).toBe('REMOTE')
  })

  it('falls back to national rather than local for an unknown destination', () => {
    expect(resolveShippingZone({})).toBe('NATIONAL')
  })
})

describe('calculateShipmentWeight', () => {
  it('uses the default weight for items without a recorded weight', () => {
    expect(calculateShipmentWeight([{ quantity: 2, weightGrams: null }])).toBe(
      DEFAULT_ITEM_WEIGHT_GRAMS * 2
    )
  })

  it('sums recorded weights across quantities', () => {
    expect(
      calculateShipmentWeight([
        { quantity: 2, weightGrams: 300 },
        { quantity: 1, weightGrams: 150 },
      ])
    ).toBe(750)
  })

  it('ignores non-positive quantities and weights', () => {
    expect(calculateShipmentWeight([{ quantity: -1, weightGrams: 300 }])).toBe(
      0
    )
    expect(calculateShipmentWeight([{ quantity: 1, weightGrams: -5 }])).toBe(
      DEFAULT_ITEM_WEIGHT_GRAMS
    )
  })
})

describe('countWeightBands', () => {
  it('always charges at least one band', () => {
    expect(countWeightBands(0)).toBe(1)
  })

  it('rounds part bands up', () => {
    expect(countWeightBands(500)).toBe(1)
    expect(countWeightBands(501)).toBe(2)
    expect(countWeightBands(1500)).toBe(3)
  })
})

describe('quoteShipping', () => {
  const destination = { state: 'Delhi', pinCode: '110001' }

  it('charges the zone base rate for a single weight band', () => {
    const quote = quoteShipping({
      destination,
      items: [{ quantity: 1, weightGrams: 400 }],
      subtotal: 100,
    })

    expect(quote.zone).toBe('NATIONAL')
    expect(quote.method).toBe('STANDARD')
    expect(quote.amount).toBe(SHIPPING_ZONE_RATES.NATIONAL.baseRate)
    expect(quote.billableWeightGrams).toBe(400)
  })

  it('adds the per-band surcharge for heavier parcels', () => {
    const quote = quoteShipping({
      destination,
      items: [{ quantity: 1, weightGrams: 1200 }],
      subtotal: 100,
    })

    // 3 bands => base + 2 additional bands
    expect(quote.amount).toBe(
      SHIPPING_ZONE_RATES.NATIONAL.baseRate +
        SHIPPING_ZONE_RATES.NATIONAL.additionalBandRate * 2
    )
  })

  it('zeroes standard shipping above the zone free-shipping threshold', () => {
    const quote = quoteShipping({
      destination,
      items: [{ quantity: 1, weightGrams: 400 }],
      subtotal: SHIPPING_ZONE_RATES.NATIONAL.freeShippingThreshold,
    })

    expect(quote.freeShippingApplied).toBe(true)
    expect(quote.amount).toBe(0)
  })

  it('never makes express shipping free', () => {
    const quote = quoteShipping({
      destination,
      items: [{ quantity: 1, weightGrams: 400 }],
      subtotal: 100_000,
      method: 'EXPRESS',
    })

    expect(quote.freeShippingApplied).toBe(false)
    expect(quote.amount).toBeGreaterThan(0)
    expect(quote.freeShippingThreshold).toBeNull()
  })

  it('delivers express faster than standard', () => {
    const base = { destination, items: [{ quantity: 1 }], subtotal: 100 }
    expect(
      quoteShipping({ ...base, method: 'EXPRESS' }).estimatedDays
    ).toBeLessThan(quoteShipping({ ...base, method: 'STANDARD' }).estimatedDays)
  })

  it('falls back to the default method for an unknown value', () => {
    expect(
      quoteShipping({
        destination,
        items: [{ quantity: 1 }],
        subtotal: 100,
        method: 'TELEPORT',
      }).method
    ).toBe('STANDARD')
  })
})

describe('quoteAllShippingMethods', () => {
  it('quotes every method for a destination', () => {
    const quotes = quoteAllShippingMethods({
      destination: { state: 'Delhi', pinCode: '110001' },
      items: [{ quantity: 1 }],
      subtotal: 100,
    })

    expect(quotes.map((quote) => quote.method)).toEqual(['STANDARD', 'EXPRESS'])
  })

  it('attaches customer-facing copy to each option', () => {
    const [standard] = buildShippingMethodOptions({
      destination: { state: 'Delhi', pinCode: '110001' },
      items: [{ quantity: 1 }],
      subtotal: 100,
    })

    expect(standard.label).toBe('Standard delivery')
    expect(standard.description).toBeTruthy()
  })
})
