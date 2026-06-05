import { describe, it, expect } from 'vitest'
import { makeStore, makeAdminStore, makeOrdersStore } from '@/lib/store'

describe('Redux storefront store', () => {
  it('creates a store with storefront slices only', () => {
    const store = makeStore()
    const state = store.getState()
    expect(state).toHaveProperty('cart')
    expect(state).toHaveProperty('wishlist')
    // Route-scoped slices live in their own stores and must not be
    // included in the storefront bundle.
    expect(state).not.toHaveProperty('admin')
    expect(state).not.toHaveProperty('orders')
  })

  it('cart initial state', () => {
    const store = makeStore()
    expect(store.getState().cart).toEqual({
      cart: null,
      loading: false,
      lastFetchedAt: null,
      error: null,
      stockWarning: null,
      adjustedQuantity: null,
    })
  })

  it('creates independent store instances', () => {
    const store1 = makeStore()
    const store2 = makeStore()
    expect(store1).not.toBe(store2)
  })
})

describe('Redux orders store', () => {
  it('creates an orders-only store', () => {
    const store = makeOrdersStore()
    const state = store.getState()
    expect(state).toHaveProperty('orders')
    expect(state).not.toHaveProperty('cart')
    expect(state).not.toHaveProperty('wishlist')
    expect(state).not.toHaveProperty('admin')
  })

  it('orders initial state', () => {
    const store = makeOrdersStore()
    expect(store.getState().orders).toEqual({
      orders: [],
      currentOrder: null,
      loading: false,
      detailLoading: false,
      cancelling: false,
      error: null,
    })
  })
})

describe('Redux admin store', () => {
  it('creates an admin-only store', () => {
    const store = makeAdminStore()
    const state = store.getState()
    expect(state).toHaveProperty('admin')
    // The admin store does not include storefront slices.
    expect(state).not.toHaveProperty('cart')
    expect(state).not.toHaveProperty('orders')
    expect(state).not.toHaveProperty('wishlist')
  })

  it('admin initial state', () => {
    const store = makeAdminStore()
    expect(store.getState().admin).toEqual({
      products: [],
      orders: [],
      users: [],
      productsLoading: false,
      ordersLoading: false,
      usersLoading: false,
      error: null,
    })
  })
})
