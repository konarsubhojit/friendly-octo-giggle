import { describe, it, expect } from 'vitest'
import { calculateTax, resolveTaxJurisdiction, INDIA_GST } from '@/lib/tax'
import { sumMoney } from '@/lib/money'

describe('resolveTaxJurisdiction', () => {
  it('defaults to the home GST market', () => {
    expect(resolveTaxJurisdiction(null).regime).toBe('GST')
    expect(resolveTaxJurisdiction('IN').regime).toBe('GST')
  })

  it('treats other markets as exempt until they are modelled', () => {
    expect(resolveTaxJurisdiction('US').regime).toBe('NONE')
  })
})

describe('calculateTax', () => {
  it('taxes the subtotal plus shipping', () => {
    const tax = calculateTax({
      subtotal: 1000,
      shippingAmount: 100,
      destination: { state: 'Delhi' },
    })

    expect(tax.taxableAmount).toBe(1100)
    expect(tax.amount).toBe(55)
    expect(tax.rate).toBe(INDIA_GST.rate)
  })

  it('charges IGST on an inter-state supply', () => {
    const tax = calculateTax({
      subtotal: 1000,
      destination: { state: 'Delhi' },
    })

    expect(tax.components).toEqual([{ name: 'IGST', rate: 0.05, amount: 50 }])
  })

  it('splits an intra-state supply into CGST and SGST', () => {
    const tax = calculateTax({
      subtotal: 1000,
      destination: { state: 'West Bengal' },
    })

    expect(tax.components.map((component) => component.name)).toEqual([
      'CGST',
      'SGST',
    ])
    expect(tax.components.every((component) => component.rate === 0.025)).toBe(
      true
    )
  })

  it('keeps split components summing exactly to the total', () => {
    const tax = calculateTax({
      subtotal: 333.33,
      shippingAmount: 0,
      destination: { state: 'West Bengal' },
    })

    expect(sumMoney(tax.components.map((component) => component.amount))).toBe(
      tax.amount
    )
  })

  it('charges nothing outside a modelled jurisdiction', () => {
    const tax = calculateTax({
      subtotal: 1000,
      destination: { state: 'California', country: 'US' },
    })

    expect(tax.amount).toBe(0)
    expect(tax.components).toEqual([])
  })
})
