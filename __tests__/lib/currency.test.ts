import { describe, it, expect } from 'vitest'
import {
  convertPriceToINR,
  formatPriceForCurrency,
  isValidCurrencyCode,
} from '@/lib/currency'

describe('isValidCurrencyCode', () => {
  it('returns true for supported codes', () => {
    expect(isValidCurrencyCode('INR')).toBe(true)
    expect(isValidCurrencyCode('USD')).toBe(true)
    expect(isValidCurrencyCode('EUR')).toBe(true)
    expect(isValidCurrencyCode('GBP')).toBe(true)
  })

  it('returns false for unknown codes', () => {
    expect(isValidCurrencyCode('JPY')).toBe(false)
    expect(isValidCurrencyCode('')).toBe(false)
    expect(isValidCurrencyCode('inr')).toBe(false)
  })
})

describe('formatPriceForCurrency', () => {
  it('formats INR amounts using the INR locale and symbol', () => {
    const formatted = formatPriceForCurrency(1234, 'INR')
    expect(formatted).toContain('1,234')
    expect(formatted).toMatch(/₹/)
  })

  it('converts and formats USD amounts', () => {
    const formatted = formatPriceForCurrency(8350, 'USD') // ~100 USD at 1/83.5
    expect(formatted).toMatch(/\$/)
    // 8350 / 83.5 = 100 exactly
    expect(formatted).toContain('100.00')
  })

  it('always renders two fraction digits', () => {
    expect(formatPriceForCurrency(0, 'USD')).toContain('0.00')
    expect(formatPriceForCurrency(1, 'USD')).toMatch(/\.\d{2}\b/)
  })
})

describe('convertPriceToINR', () => {
  it('round-trips USD amounts back to INR', () => {
    // 100 USD -> ~8350 INR (rate is 1/83.5)
    expect(convertPriceToINR(100, 'USD')).toBeCloseTo(8350, 5)
  })

  it('returns 0 for negative amounts', () => {
    expect(convertPriceToINR(-1, 'USD')).toBe(0)
  })

  it('returns 0 for non-finite amounts', () => {
    expect(convertPriceToINR(Number.NaN, 'USD')).toBe(0)
    expect(convertPriceToINR(Number.POSITIVE_INFINITY, 'INR')).toBe(0)
  })

  it('returns the same amount for INR (rate = 1)', () => {
    expect(convertPriceToINR(500, 'INR')).toBe(500)
  })
})
