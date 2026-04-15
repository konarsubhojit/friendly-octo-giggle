import { describe, it, expect } from 'vitest'
import {
  getVariantMinPrice,
  getVariantTotalStock,
  getFirstInStockVariant,
} from '@/features/product/variant-utils'

describe('variant-utils', () => {
  describe('getVariantMinPrice', () => {
    it('returns 0 for undefined', () => {
      expect(getVariantMinPrice(undefined)).toBe(0)
    })

    it('returns 0 for null', () => {
      expect(getVariantMinPrice(null)).toBe(0)
    })

    it('returns 0 for empty array', () => {
      expect(getVariantMinPrice([])).toBe(0)
    })

    it('returns the single price for one variant', () => {
      expect(getVariantMinPrice([{ price: 500 }])).toBe(500)
    })

    it('returns the minimum price among variants', () => {
      expect(
        getVariantMinPrice([{ price: 300 }, { price: 100 }, { price: 200 }])
      ).toBe(100)
    })
  })

  describe('getVariantTotalStock', () => {
    it('returns 0 for undefined', () => {
      expect(getVariantTotalStock(undefined)).toBe(0)
    })

    it('returns 0 for null', () => {
      expect(getVariantTotalStock(null)).toBe(0)
    })

    it('returns 0 for empty array', () => {
      expect(getVariantTotalStock([])).toBe(0)
    })

    it('returns the single stock for one variant', () => {
      expect(getVariantTotalStock([{ stock: 5 }])).toBe(5)
    })

    it('returns the sum of stock across variants', () => {
      expect(
        getVariantTotalStock([{ stock: 3 }, { stock: 7 }, { stock: 0 }])
      ).toBe(10)
    })
  })

  describe('getFirstInStockVariant', () => {
    it('returns null for undefined', () => {
      expect(getFirstInStockVariant(undefined)).toBeNull()
    })

    it('returns null for null', () => {
      expect(getFirstInStockVariant(null)).toBeNull()
    })

    it('returns null for empty array', () => {
      expect(getFirstInStockVariant([])).toBeNull()
    })

    it('returns the first in-stock variant', () => {
      const variants = [
        { id: 'a', stock: 0 },
        { id: 'b', stock: 5 },
        { id: 'c', stock: 3 },
      ]
      expect(getFirstInStockVariant(variants)).toEqual({ id: 'b', stock: 5 })
    })

    it('falls back to first variant when all out of stock', () => {
      const variants = [
        { id: 'x', stock: 0 },
        { id: 'y', stock: 0 },
      ]
      expect(getFirstInStockVariant(variants)).toEqual({ id: 'x', stock: 0 })
    })

    it('returns the first variant when it is in stock', () => {
      const variants = [
        { id: 'a', stock: 10 },
        { id: 'b', stock: 5 },
      ]
      expect(getFirstInStockVariant(variants)).toEqual({ id: 'a', stock: 10 })
    })
  })
})
