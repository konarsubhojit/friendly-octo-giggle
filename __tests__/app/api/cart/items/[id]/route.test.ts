import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH, DELETE } from '@/app/api/cart/items/[id]/route'
import { primaryDrizzleDb as drizzleDb } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'
import { invalidateCartCache } from '@/lib/cache'

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    query: {
      cartItems: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}))
vi.mock('@/lib/schema', () => ({ cartItems: { id: 'id' } }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock(
  '@/lib/validations',
  async () => await vi.importActual('@/lib/validations')
)
vi.mock('@/lib/api-utils', async () => await vi.importActual('@/lib/api-utils'))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))
vi.mock('@/lib/cache', () => ({ invalidateCartCache: vi.fn() }))
vi.mock('@/features/cart/services/cart-redis', () => ({
  updateCartItemQuantityInRedis: vi.fn(() => Promise.resolve()),
  removeCartItemFromRedis: vi.fn(() => Promise.resolve()),
}))

const mockAuth = vi.mocked(auth)
const mockFindFirst = vi.mocked(drizzleDb.query.cartItems.findFirst)
const mockUpdate = vi.mocked(drizzleDb.update)
const mockDelete = vi.mocked(drizzleDb.delete)
const mockLogError = vi.mocked(logError)
const mockInvalidateCartCache = vi.mocked(invalidateCartCache)

describe('PATCH /api/cart/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid body (missing quantity)', async () => {
    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 404 when item not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue(undefined)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 2 }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Cart item not found')
  })

  it('returns 403 when not owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: 'other-user' },
      product: { variants: [] },
      variant: null,
      variantId: null,
    } as never)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 2 }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 for insufficient stock', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: 'user1' },
      product: { variants: [{ id: 'v1', stock: 5 }] },
      variant: { stock: 5 },
      variantId: 'v1',
    } as never)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 10 }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Insufficient stock')
  })

  it('returns 400 for insufficient stock with variation', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: 'user1' },
      product: { variants: [{ id: 'var1', stock: 3 }] },
      variant: { stock: 3 },
      variantId: 'var1',
    } as never)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 5 }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Insufficient stock')
  })

  it('updates quantity successfully', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: 'user1' },
      product: { variants: [{ id: 'v1', stock: 10 }] },
      variant: { stock: 10 },
      variantId: 'v1',
    } as never)
    const mockWhere = vi.fn()
    const mockSet = vi.fn(() => ({ where: mockWhere }))
    mockUpdate.mockReturnValue({ set: mockSet } as never)
    mockInvalidateCartCache.mockResolvedValue(undefined)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 2 }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockInvalidateCartCache).toHaveBeenCalledWith('user1', undefined)
  })

  it('updates quantity successfully with sessionId (guest)', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: null, sessionId: 'session123' },
      product: { variants: [{ id: 'v1', stock: 10 }] },
      variant: { stock: 10 },
      variantId: 'v1',
    } as never)
    const mockWhere = vi.fn()
    const mockSet = vi.fn(() => ({ where: mockWhere }))
    mockUpdate.mockReturnValue({ set: mockSet } as never)
    mockInvalidateCartCache.mockResolvedValue(undefined)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 2 }),
      headers: {
        'content-type': 'application/json',
        cookie: 'cart_session=session123',
      },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockInvalidateCartCache).toHaveBeenCalledWith(
      undefined,
      'session123'
    )
  })

  it('returns 500 on error', async () => {
    mockAuth.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 2 }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to update cart item')
    expect(mockLogError).toHaveBeenCalledWith({
      error: expect.any(Error),
      context: 'cart_item_update',
    })
  })
})

describe('DELETE /api/cart/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when item not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue(undefined)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Cart item not found')
  })

  it('returns 403 when not owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: 'other-user' },
    } as never)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Unauthorized')
  })

  it('deletes item successfully', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } } as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: 'user1' },
    } as never)
    const mockWhere = vi.fn()
    mockDelete.mockReturnValue({ where: mockWhere } as never)
    mockInvalidateCartCache.mockResolvedValue(undefined)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
    expect(mockInvalidateCartCache).toHaveBeenCalledWith('user1', undefined)
  })

  it('deletes item successfully with sessionId (guest)', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockFindFirst.mockResolvedValue({
      id: 'item1',
      cart: { userId: null, sessionId: 'session123' },
    } as never)
    const mockWhere = vi.fn()
    mockDelete.mockReturnValue({ where: mockWhere } as never)
    mockInvalidateCartCache.mockResolvedValue(undefined)

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'DELETE',
      headers: {
        cookie: 'cart_session=session123',
      },
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockInvalidateCartCache).toHaveBeenCalledWith(
      undefined,
      'session123'
    )
  })

  it('returns 500 on error', async () => {
    mockAuth.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost/api/cart/items/item1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'item1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to delete cart item')
    expect(mockLogError).toHaveBeenCalledWith({
      error: expect.any(Error),
      context: 'cart_item_delete',
    })
  })
})
