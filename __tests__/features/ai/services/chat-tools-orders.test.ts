import { beforeEach, describe, expect, it, vi } from 'vitest'

const ordersFindFirstMock = vi.hoisted(() => vi.fn())
const ordersFindManyMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      orders: {
        findFirst: ordersFindFirstMock,
        findMany: ordersFindManyMock,
      },
    },
  },
}))

import { dispatchToolCall } from '@/features/ai/services/chat-tools'

describe('chat-tools-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ordersFindFirstMock.mockResolvedValue(null)
    ordersFindManyMock.mockResolvedValue([])
  })

  it('returns a sign-in message and does not query the database for guests', async () => {
    const output = await dispatchToolCall(
      'get_order_status',
      { orderId: 'ORD1234', userId: 'other-user' },
      {
        identity: { userId: 'guest:abc', isAuthenticated: false },
        currencyCode: 'INR',
        formatPrice: (priceInINR: number) => `₹${priceInINR}`,
      }
    )

    expect(output).toBe('Sign in to check your orders.')
    expect(ordersFindFirstMock).not.toHaveBeenCalled()
    expect(ordersFindManyMock).not.toHaveBeenCalled()
  })

  it('scopes explicit order lookups to the authenticated account only', async () => {
    const output = await dispatchToolCall(
      'get_order_status',
      { orderId: 'ORD1234' },
      {
        identity: { userId: 'user-1', isAuthenticated: true },
        currencyCode: 'INR',
        formatPrice: (priceInINR: number) => `₹${priceInINR}`,
      }
    )

    expect(ordersFindFirstMock).toHaveBeenCalled()
    expect(output).toBe('No order with ID "ORD1234" was found for this account.')
  })

  it('returns recent order status for the authenticated shopper', async () => {
    ordersFindManyMock.mockResolvedValue([
      {
        id: 'ORD1001',
        status: 'SHIPPED',
        trackingNumber: 'TRK1001',
        shippingProvider: 'BlueDart',
      },
    ])

    const output = await dispatchToolCall(
      'get_order_status',
      {},
      {
        identity: { userId: 'user-1', isAuthenticated: true },
        currencyCode: 'INR',
        formatPrice: (priceInINR: number) => `₹${priceInINR}`,
      }
    )

    expect(output).toContain('Recent order status:')
    expect(output).toContain('ORD1001: SHIPPED, tracking TRK1001, carrier BlueDart')
  })
})
