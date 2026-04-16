// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPendingCartItems,
  addPendingCartItem,
  clearPendingCartItems,
  hasPendingCartItems,
} from '@/features/cart/services/pending-cart'

// Valid 7-char base62 IDs matching SHORT_ID_REGEX
const PRODUCT_ID_1 = 'aB1cD2e'
const PRODUCT_ID_2 = 'fG3hI4j'
const VARIANT_ID_1 = 'kL5mN6o'
const VARIANT_ID_2 = 'pQ7rS8t'

describe('pending-cart', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getPendingCartItems', () => {
    it('returns empty array when nothing stored', () => {
      expect(getPendingCartItems()).toEqual([])
    })

    it('returns stored items', () => {
      const items = [
        {
          productId: PRODUCT_ID_1,
          variantId: VARIANT_ID_1,
          quantity: 2,
        },
      ]
      localStorage.setItem('pending_cart_items', JSON.stringify(items))

      expect(getPendingCartItems()).toEqual(items)
    })

    it('returns empty array for invalid JSON', () => {
      localStorage.setItem('pending_cart_items', 'not-json{')
      expect(getPendingCartItems()).toEqual([])
    })

    it('returns empty array when stored value is not an array', () => {
      localStorage.setItem('pending_cart_items', JSON.stringify({ id: 1 }))
      expect(getPendingCartItems()).toEqual([])
    })

    it('filters out entries with invalid fields', () => {
      const items = [
        {
          productId: PRODUCT_ID_1,
          variantId: VARIANT_ID_1,
          quantity: 1,
        },
        // invalid variantId (empty string)
        { productId: PRODUCT_ID_1, variantId: '', quantity: 2 },
        // invalid variantId (too short)
        { productId: PRODUCT_ID_2, variantId: 'short', quantity: 1 },
        // invalid productId (empty string)
        { productId: '', variantId: VARIANT_ID_1, quantity: 1 },
        // invalid productId (too short)
        { productId: 'ab', variantId: VARIANT_ID_2, quantity: 1 },
        // invalid quantity (zero)
        {
          productId: PRODUCT_ID_2,
          variantId: VARIANT_ID_2,
          quantity: 0,
        },
        // invalid quantity (negative)
        {
          productId: PRODUCT_ID_2,
          variantId: VARIANT_ID_2,
          quantity: -1,
        },
        // invalid quantity (non-integer)
        {
          productId: PRODUCT_ID_2,
          variantId: VARIANT_ID_2,
          quantity: 1.5,
        },
      ]
      localStorage.setItem('pending_cart_items', JSON.stringify(items))

      const result = getPendingCartItems()
      expect(result).toHaveLength(1)
      expect(result[0].productId).toBe(PRODUCT_ID_1)
      expect(result[0].variantId).toBe(VARIANT_ID_1)
      expect(result[0].quantity).toBe(1)
    })
  })

  describe('addPendingCartItem', () => {
    it('adds a new item', () => {
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 1,
      })

      const stored = getPendingCartItems()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toEqual({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 1,
      })
    })

    it('increments quantity for duplicate product+variant', () => {
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 2,
      })
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 3,
      })

      const stored = getPendingCartItems()
      expect(stored).toHaveLength(1)
      expect(stored[0].quantity).toBe(5)
    })

    it('adds separate entry for different variant', () => {
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 1,
      })
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_2,
        quantity: 1,
      })

      expect(getPendingCartItems()).toHaveLength(2)
    })

    it('adds separate entry for different product', () => {
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 1,
      })
      addPendingCartItem({
        productId: PRODUCT_ID_2,
        variantId: VARIANT_ID_2,
        quantity: 1,
      })

      expect(getPendingCartItems()).toHaveLength(2)
    })
  })

  describe('clearPendingCartItems', () => {
    it('removes all pending cart items', () => {
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 1,
      })
      expect(hasPendingCartItems()).toBe(true)

      clearPendingCartItems()
      expect(getPendingCartItems()).toEqual([])
      expect(hasPendingCartItems()).toBe(false)
    })
  })

  describe('hasPendingCartItems', () => {
    it('returns false when no items', () => {
      expect(hasPendingCartItems()).toBe(false)
    })

    it('returns true when items exist', () => {
      addPendingCartItem({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
        quantity: 1,
      })
      expect(hasPendingCartItems()).toBe(true)
    })
  })
})
