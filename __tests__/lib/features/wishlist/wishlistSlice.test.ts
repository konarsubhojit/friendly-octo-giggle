import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import type { Product } from '@/lib/types'
import wishlistReducer, {
  optimisticToggle,
  fetchWishlist,
  addToWishlist,
  removeFromWishlist,
} from '@/features/wishlist/store/wishlistSlice'

const initialState = {
  productIds: [],
  products: [],
  loading: false,
  error: null,
}

function makeStore(preloaded?: object) {
  return configureStore({
    reducer: { wishlist: wishlistReducer },
    preloadedState: preloaded,
  })
}

const mockProduct: Product = {
  id: 'prod001',
  name: 'Test Product',
  description: 'A test product',
  price: 999,
  image: 'https://example.com/img.jpg',
  images: [],
  stock: 10,
  category: 'test',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

describe('wishlistSlice reducer', () => {
  it('returns initial state for unknown action', () => {
    expect(wishlistReducer(undefined, { type: 'unknown' })).toEqual(
      initialState
    )
  })

  describe('optimisticToggle', () => {
    it('adds productId when not present', () => {
      const result = wishlistReducer(initialState, optimisticToggle('prod001'))
      expect(result.productIds).toContain('prod001')
    })

    it('removes productId and product when already present', () => {
      const state = {
        ...initialState,
        productIds: ['prod001'],
        products: [mockProduct],
      }
      const result = wishlistReducer(state, optimisticToggle('prod001'))
      expect(result.productIds).not.toContain('prod001')
      expect(result.products).toHaveLength(0)
    })

    it('does not duplicate productId when toggling absent id', () => {
      const state = {
        ...initialState,
        productIds: ['prod002'],
        products: [],
      }
      const result = wishlistReducer(state, optimisticToggle('prod001'))
      expect(result.productIds).toContain('prod001')
      expect(result.productIds).toContain('prod002')
      expect(result.productIds).toHaveLength(2)
    })
  })

  describe('fetchWishlist extraReducers', () => {
    it('sets loading true on pending', () => {
      const result = wishlistReducer(initialState, {
        type: fetchWishlist.pending.type,
      })
      expect(result.loading).toBe(true)
      expect(result.error).toBeNull()
    })

    it('sets products and productIds on fulfilled', () => {
      const result = wishlistReducer(initialState, {
        type: fetchWishlist.fulfilled.type,
        payload: { products: [mockProduct], productIds: ['prod001'] },
      })
      expect(result.loading).toBe(false)
      expect(result.products).toEqual([mockProduct])
      expect(result.productIds).toEqual(['prod001'])
    })

    it('sets error on rejected', () => {
      const result = wishlistReducer(initialState, {
        type: fetchWishlist.rejected.type,
        payload: 'Failed to fetch wishlist',
      })
      expect(result.loading).toBe(false)
      expect(result.error).toBe('Failed to fetch wishlist')
    })
  })

  describe('addToWishlist extraReducers', () => {
    it('sets error on rejected', () => {
      const result = wishlistReducer(initialState, {
        type: addToWishlist.rejected.type,
        payload: 'Failed to add to wishlist',
      })
      expect(result.error).toBe('Failed to add to wishlist')
    })
  })

  describe('removeFromWishlist extraReducers', () => {
    it('sets error on rejected', () => {
      const result = wishlistReducer(initialState, {
        type: removeFromWishlist.rejected.type,
        payload: 'Failed to remove from wishlist',
      })
      expect(result.error).toBe('Failed to remove from wishlist')
    })
  })
})

describe('wishlistSlice async thunks', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchWishlist thunk', () => {
    it('fulfilled: sets products and productIds from API response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { products: [mockProduct], productIds: ['prod001'] },
            }),
        })
      )
      const store = makeStore()
      await store.dispatch(fetchWishlist())
      const state = store.getState().wishlist
      expect(state.products).toEqual([mockProduct])
      expect(state.productIds).toEqual(['prod001'])
      expect(state.loading).toBe(false)
    })

    it('fulfilled: handles missing data fields with empty arrays', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: {} }),
        })
      )
      const store = makeStore()
      await store.dispatch(fetchWishlist())
      const state = store.getState().wishlist
      expect(state.products).toEqual([])
      expect(state.productIds).toEqual([])
    })

    it('fulfilled: returns empty arrays on 401 (unauthenticated)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' }),
        })
      )
      const store = makeStore()
      await store.dispatch(fetchWishlist())
      const state = store.getState().wishlist
      expect(state.products).toEqual([])
      expect(state.productIds).toEqual([])
      expect(state.error).toBeNull()
    })

    it('rejected: sets error on non-401 API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        })
      )
      const store = makeStore()
      await store.dispatch(fetchWishlist())
      const state = store.getState().wishlist
      expect(state.error).toBe('Server error')
    })

    it('rejected: sets fallback error on network failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      )
      const store = makeStore()
      await store.dispatch(fetchWishlist())
      const state = store.getState().wishlist
      expect(state.error).toBe('Failed to fetch wishlist')
    })
  })

  describe('addToWishlist thunk', () => {
    it('fulfilled: dispatches successfully (no state change on success)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      )
      const store = makeStore()
      const result = await store.dispatch(addToWishlist('prod001'))
      expect(result.type).toBe(addToWishlist.fulfilled.type)
    })

    it('rejected: sets error from API response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Already in wishlist' }),
        })
      )
      const store = makeStore()
      await store.dispatch(addToWishlist('prod001'))
      const state = store.getState().wishlist
      expect(state.error).toBe('Already in wishlist')
    })

    it('rejected: sets fallback error on non-ApiError', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('network error'))
      )
      const store = makeStore()
      await store.dispatch(addToWishlist('prod001'))
      const state = store.getState().wishlist
      expect(state.error).toBe('Failed to add to wishlist')
    })
  })

  describe('removeFromWishlist thunk', () => {
    it('fulfilled: dispatches successfully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      )
      const store = makeStore()
      const result = await store.dispatch(removeFromWishlist('prod001'))
      expect(result.type).toBe(removeFromWishlist.fulfilled.type)
    })

    it('rejected: sets error from API response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found in wishlist' }),
        })
      )
      const store = makeStore()
      await store.dispatch(removeFromWishlist('prod001'))
      const state = store.getState().wishlist
      expect(state.error).toBe('Not found in wishlist')
    })

    it('rejected: sets fallback error on non-ApiError', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('network error'))
      )
      const store = makeStore()
      await store.dispatch(removeFromWishlist('prod001'))
      const state = store.getState().wishlist
      expect(state.error).toBe('Failed to remove from wishlist')
    })
  })
})
