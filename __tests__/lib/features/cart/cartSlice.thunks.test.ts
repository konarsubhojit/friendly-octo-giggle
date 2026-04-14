/**
 * Supplementary tests for cartSlice async thunks (function body coverage).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import cartReducer, {
  fetchCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '@/features/cart/store/cartSlice'

function makeStore(preloaded?: object) {
  return configureStore({
    reducer: { cart: cartReducer },
    preloadedState: preloaded,
  })
}

const mockCart = {
  id: 'cart-1',
  items: [{ id: 'item-1', quantity: 2, productId: 'p1' }],
  userId: 'u1',
  sessionId: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

describe('cartSlice async thunks (fetch bodies)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchCart fulfilled sets cart via real dispatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cart: mockCart }),
      })
    )
    const store = makeStore()
    await store.dispatch(fetchCart())
    expect(store.getState().cart.cart).toEqual(mockCart)
    expect(store.getState().cart.loading).toBe(false)
    expect(store.getState().cart.lastFetchedAt).toBeTypeOf('number')
  })

  it('fetchCart skips duplicate requests while the cart is fresh and refetches after the ttl', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cart: mockCart }),
    })
    vi.stubGlobal('fetch', fetchMock)
    let now = 1_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    const store = makeStore()
    await store.dispatch(fetchCart())
    await store.dispatch(fetchCart())
    now = 61_001
    await store.dispatch(fetchCart())

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fetchCart can still be forced while the cart is fresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cart: mockCart }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date, 'now').mockReturnValue(5_000)

    const store = makeStore()
    await store.dispatch(fetchCart())
    await store.dispatch(fetchCart({ force: true }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fetchCart rejected sets error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )
    const store = makeStore()
    await store.dispatch(fetchCart())
    expect(store.getState().cart.error).toBe('Network error')
  })

  it('addToCart fulfilled sets cart', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cart: mockCart }),
      })
    )
    const store = makeStore()
    await store.dispatch(
      addToCart({ productId: 'p1', quantity: 1, variantId: 'v1' })
    )
    expect(store.getState().cart.cart).toEqual(mockCart)
  })

  it('addToCart rejected sets error when response not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Out of stock' }),
      })
    )
    const store = makeStore()
    await store.dispatch(addToCart({ productId: 'p1', variantId: 'v1', quantity: 99 }))
    expect(store.getState().cart.error).toBe('Out of stock')
  })

  it('addToCart rejected uses fallback error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({}),
      })
    )
    const store = makeStore()
    await store.dispatch(addToCart({ productId: 'p1', variantId: 'v1', quantity: 1 }))
    expect(store.getState().cart.error).toBe('Request failed (400)')
  })

  it('updateCartItem fulfilled sets cart', async () => {
    const updatedCart = {
      ...mockCart,
      items: [{ ...mockCart.items[0], quantity: 5 }],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cart: updatedCart }),
      })
    )
    const store = makeStore()
    await store.dispatch(updateCartItem({ itemId: 'item-1', quantity: 5 }))
    expect(store.getState().cart.cart).toEqual(updatedCart)
  })

  it('updateCartItem rejected sets error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Item not found' }),
      })
    )
    const store = makeStore()
    await store.dispatch(updateCartItem({ itemId: 'bad-id', quantity: 1 }))
    expect(store.getState().cart.error).toBe('Item not found')
  })

  it('removeCartItem fulfilled sets cart', async () => {
    const emptyCart = { ...mockCart, items: [] }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cart: emptyCart }),
      })
    )
    const store = makeStore()
    await store.dispatch(removeCartItem('item-1'))
    expect(store.getState().cart.cart).toEqual(emptyCart)
  })

  it('removeCartItem rejected sets error when not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Item not found' }),
      })
    )
    const store = makeStore()
    await store.dispatch(removeCartItem('bad-id'))
    expect(store.getState().cart.error).toBe('Item not found')
  })

  it('clearCart fulfilled sets cart to null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    )
    const store = makeStore({
      cart: {
        cart: mockCart,
        loading: false,
        lastFetchedAt: 1_000,
        error: null,
        stockWarning: null,
        adjustedQuantity: null,
      },
    })
    await store.dispatch(clearCart())
    expect(store.getState().cart.cart).toBeNull()
  })

  it('clearCart rejected sets error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
    )
    const store = makeStore()
    await store.dispatch(clearCart())
    expect(store.getState().cart.error).toBe('Server error')
  })
})
