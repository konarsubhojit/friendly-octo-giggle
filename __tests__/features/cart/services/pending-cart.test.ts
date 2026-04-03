import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPendingCartItems,
  addPendingCartItem,
  clearPendingCartItems,
  hasPendingCartItems,
} from '@/features/cart/services/pending-cart'

describe('pending-cart', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getPendingCartItems', () => {
    it('returns empty array when nothing stored', () => {
      expect(getPendingCartItems()).toEqual([])
    })

    it('returns stored items', () => {
      const items = [{ productId: 'p1', variationId: null, quantity: 2 }]
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
  })

  describe('addPendingCartItem', () => {
    it('adds a new item', () => {
      addPendingCartItem({ productId: 'p1', variationId: null, quantity: 1 })

      const stored = getPendingCartItems()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toEqual({
        productId: 'p1',
        variationId: null,
        quantity: 1,
      })
    })

    it('increments quantity for duplicate product+variation', () => {
      addPendingCartItem({ productId: 'p1', variationId: 'v1', quantity: 2 })
      addPendingCartItem({ productId: 'p1', variationId: 'v1', quantity: 3 })

      const stored = getPendingCartItems()
      expect(stored).toHaveLength(1)
      expect(stored[0].quantity).toBe(5)
    })

    it('adds separate entry for different variation', () => {
      addPendingCartItem({ productId: 'p1', variationId: 'v1', quantity: 1 })
      addPendingCartItem({ productId: 'p1', variationId: 'v2', quantity: 1 })

      expect(getPendingCartItems()).toHaveLength(2)
    })

    it('adds separate entry for different product', () => {
      addPendingCartItem({ productId: 'p1', variationId: null, quantity: 1 })
      addPendingCartItem({ productId: 'p2', variationId: null, quantity: 1 })

      expect(getPendingCartItems()).toHaveLength(2)
    })
  })

  describe('clearPendingCartItems', () => {
    it('removes all pending cart items', () => {
      addPendingCartItem({ productId: 'p1', variationId: null, quantity: 1 })
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
      addPendingCartItem({ productId: 'p1', variationId: null, quantity: 1 })
      expect(hasPendingCartItems()).toBe(true)
    })
  })
})
