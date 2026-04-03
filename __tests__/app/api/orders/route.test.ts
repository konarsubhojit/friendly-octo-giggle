import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/orders/route'

const mockAuth = vi.hoisted(() => vi.fn())
const mockGetUserOrders = vi.hoisted(() => vi.fn())
const mockIsOrderRequestError = vi.hoisted(() => vi.fn())
const mockEnqueueCheckoutForUser = vi.hoisted(() => vi.fn())
const mockIsCheckoutRequestError = vi.hoisted(() => vi.fn())
const mockLogBusinessEvent = vi.hoisted(() => vi.fn())
const mockLogError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-middleware', () => ({
  withLogging: vi.fn((handler) => handler),
}))

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/features/orders/services/order-service', () => ({
  getUserOrders: mockGetUserOrders,
  isOrderRequestError: mockIsOrderRequestError,
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  enqueueCheckoutForUser: mockEnqueueCheckoutForUser,
  isCheckoutRequestError: mockIsCheckoutRequestError,
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: mockLogError,
}))

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsOrderRequestError.mockReturnValue(false)
    mockIsCheckoutRequestError.mockReturnValue(false)
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET(new NextRequest('http://localhost/api/orders'))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authentication required')
  })

  it('returns user orders when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    })
    mockGetUserOrders.mockResolvedValue({
      orders: [{ id: 'ORD12345' }],
      hasMore: false,
      nextCursor: null,
      totalCount: 1,
    })

    const response = await GET(new NextRequest('http://localhost/api/orders'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.orders).toEqual([{ id: 'ORD12345' }])
    expect(mockGetUserOrders).toHaveBeenCalledWith({
      requestUrl: 'http://localhost/api/orders',
      userId: 'user1',
    })
  })

  it('returns 500 when fetching orders fails', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    })
    mockGetUserOrders.mockRejectedValue(new Error('Database error'))

    const response = await GET(new NextRequest('http://localhost/api/orders'))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch orders')
    expect(mockLogError).toHaveBeenCalled()
  })
})

describe('POST /api/orders', () => {
  const validBody = {
    customerAddress: '123 Test Street, Kolkata, 700001',
    items: [{ productId: 'ABC1234', quantity: 1 }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsOrderRequestError.mockReturnValue(false)
    mockIsCheckoutRequestError.mockReturnValue(false)
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'content-type': 'application/json' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Authentication required')
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'order_create_failed',
        details: { reason: 'not_authenticated' },
        success: false,
      })
    )
  })

  it('returns 202 when checkout request is queued', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    })
    mockEnqueueCheckoutForUser.mockResolvedValue({
      checkoutRequestId: 'CHK1234',
      status: 'PENDING',
    })

    const response = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'content-type': 'application/json' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(202)
    expect(data).toEqual({
      checkoutRequestId: 'CHK1234',
      status: 'PENDING',
    })
    expect(mockEnqueueCheckoutForUser).toHaveBeenCalledWith({
      body: validBody,
      user: {
        id: 'user1',
        name: 'Test',
        email: 'test@example.com',
      },
    })
  })

  it('returns checkout validation errors from the queue service', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    })
    mockEnqueueCheckoutForUser.mockRejectedValue({
      message: 'Address must be at least 10 characters',
      status: 400,
    })
    mockIsCheckoutRequestError.mockReturnValue(true)

    const response = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, customerAddress: 'short' }),
        headers: { 'content-type': 'application/json' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Address must be at least 10 characters')
  })

  it('returns order request errors when surfaced', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    })
    mockEnqueueCheckoutForUser.mockRejectedValue({
      message: 'Insufficient stock for Test Product',
      status: 409,
    })
    mockIsOrderRequestError.mockReturnValue(true)

    const response = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'content-type': 'application/json' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe('Insufficient stock for Test Product')
  })

  it('returns 500 on unexpected enqueue failures', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    })
    mockEnqueueCheckoutForUser.mockRejectedValue(new Error('Queue down'))

    const response = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'content-type': 'application/json' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to create checkout request')
    expect(mockLogError).toHaveBeenCalled()
  })
})
