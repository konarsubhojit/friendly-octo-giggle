import { describe, expect, it } from 'vitest'
import {
  MAX_MONEY_AMOUNT,
  MoneyRangeError,
  convertMoney,
  formatMoneyValue,
  fromMinorUnits,
  isSupportedMoneyAmount,
  multiplyMoney,
  parseMoney,
  roundMoney,
  sumMoney,
  toMinorUnits,
} from '@/lib/money'

describe('toMinorUnits', () => {
  it('converts major units to integer minor units', () => {
    expect(toMinorUnits(199)).toBe(19900)
    expect(toMinorUnits(19.99)).toBe(1999)
    expect(toMinorUnits(0)).toBe(0)
  })

  it('rounds symmetrically for positive and negative amounts', () => {
    // 1.005 is not exactly representable as a double (it is stored slightly
    // below 1.005), so it rounds down — the important guarantee is that the
    // sign does not change the magnitude of the result.
    expect(toMinorUnits(1.005)).toBe(100)
    expect(toMinorUnits(-1.005)).toBe(-100)
    expect(toMinorUnits(2.345)).toBe(235)
    expect(toMinorUnits(-2.345)).toBe(-235)
  })

  it('handles negative amounts', () => {
    expect(toMinorUnits(-19.99)).toBe(-1999)
  })

  it('rejects non-finite amounts', () => {
    expect(() => toMinorUnits(Number.NaN)).toThrow(MoneyRangeError)
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY)).toThrow(
      MoneyRangeError
    )
  })

  it('rejects amounts outside the safe integer range', () => {
    expect(() => toMinorUnits(Number.MAX_SAFE_INTEGER)).toThrow(MoneyRangeError)
  })
})

describe('fromMinorUnits', () => {
  it('converts minor units back to major units', () => {
    expect(fromMinorUnits(19900)).toBe(199)
    expect(fromMinorUnits(1999)).toBe(19.99)
  })

  it('rejects non-integer input', () => {
    expect(() => fromMinorUnits(19.5)).toThrow(MoneyRangeError)
  })
})

describe('roundMoney', () => {
  it('normalises to the persisted precision', () => {
    expect(roundMoney(19.994)).toBe(19.99)
    expect(roundMoney(19.995)).toBe(20)
  })

  it('round-trips through minor units', () => {
    for (const amount of [0, 0.01, 1.1, 99.99, 12345.67]) {
      expect(fromMinorUnits(toMinorUnits(amount))).toBe(amount)
    }
  })
})

describe('sumMoney', () => {
  it('sums without floating point drift', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('sums an empty list to zero', () => {
    expect(sumMoney([])).toBe(0)
  })

  it('sums many small amounts exactly', () => {
    expect(sumMoney(Array.from({ length: 10 }, () => 0.1))).toBe(1)
  })
})

describe('multiplyMoney', () => {
  it('multiplies a price by a quantity exactly', () => {
    expect(multiplyMoney(0.1, 3)).toBe(0.3)
    expect(multiplyMoney(19.99, 3)).toBe(59.97)
  })

  it('rejects fractional quantities', () => {
    expect(() => multiplyMoney(10, 1.5)).toThrow(MoneyRangeError)
  })
})

describe('convertMoney', () => {
  it('applies a rate and rounds to the persisted precision', () => {
    expect(convertMoney(100, 0.5)).toBe(50)
    expect(convertMoney(83.5, 1 / 83.5)).toBe(1)
  })

  it('rejects non-finite rates', () => {
    expect(() => convertMoney(100, Number.NaN)).toThrow(MoneyRangeError)
  })
})

describe('formatMoneyValue', () => {
  it('always renders two decimal places', () => {
    expect(formatMoneyValue(199)).toBe('199.00')
    expect(formatMoneyValue(19.9)).toBe('19.90')
    expect(formatMoneyValue(19.999)).toBe('20.00')
  })

  it('round-trips through parseMoney', () => {
    for (const amount of [0, 1.05, 199, 12345.67]) {
      expect(parseMoney(formatMoneyValue(amount))).toBe(amount)
    }
  })
})

describe('parseMoney', () => {
  it('parses numeric strings from the database driver', () => {
    expect(parseMoney('199.00')).toBe(199)
    expect(parseMoney('19.99')).toBe(19.99)
  })

  it('parses numbers', () => {
    expect(parseMoney(19.994)).toBe(19.99)
  })

  it('returns null for invalid values', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney(null)).toBeNull()
    expect(parseMoney(undefined)).toBeNull()
    expect(parseMoney(Number.NaN)).toBeNull()
  })
})

describe('isSupportedMoneyAmount', () => {
  it('accepts amounts inside the numeric(12, 2) range', () => {
    expect(isSupportedMoneyAmount(0)).toBe(true)
    expect(isSupportedMoneyAmount(MAX_MONEY_AMOUNT)).toBe(true)
  })

  it('rejects out-of-range and non-finite amounts', () => {
    expect(isSupportedMoneyAmount(MAX_MONEY_AMOUNT + 1)).toBe(false)
    expect(isSupportedMoneyAmount(Number.NaN)).toBe(false)
  })
})
