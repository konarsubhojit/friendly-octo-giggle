import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockInsert,
  mockUpdate,
  mockDrizzleDbSelect,
  mockLogBusinessEvent,
  mockLogError,
  mockSend,
  mockCreateOrderForUser,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDrizzleDbSelect: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue(null),
  })),
  mockLogBusinessEvent: vi.fn(),
  mockLogError: vi.fn(),
  mockSend: vi.fn(),
  mockCreateOrderForUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: mockDrizzleDbSelect,
  },
  primaryDrizzleDb: {
    insert: mockInsert,
    update: mockUpdate,
  },
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: mockLogError,
}))

vi.mock('@/lib/queue', () => ({
  send: mockSend,
}))

vi.mock('@/features/orders/services/order-service', () => ({
  createOrderForUser: mockCreateOrderForUser,
  isOrderRequestError: (error: unknown) =>
    error instanceof Error && 'status' in error,
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}))

vi.mock('@/lib/schema', () => ({
  checkoutRequests: { id: 'id', status: 'status', userId: 'userId' },
  orders: { id: 'id', checkoutRequestId: 'checkoutRequestId' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
}))

import {
  enqueueCheckoutForUser,
  getCheckoutRequestStatusForUser,
  processCheckoutRequestById,
  getRecentCheckoutRequests,
  recoverCheckoutRequestAfterRetryExhaustion,
  isCheckoutRequestError,
  type CheckoutSessionUser,
} from '@/features/cart/services/checkout-service'

const testUser: CheckoutSessionUser = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
}

describe('checkout-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isCheckoutRequestError', () => {
    it('returns false for plain errors', () => {
      expect(isCheckoutRequestError(new Error('test'))).toBe(false)
    })

    it('returns false for non-error values', () => {
      expect(isCheckoutRequestError('string')).toBe(false)
      expect(isCheckoutRequestError(null)).toBe(false)
    })
  })

  describe('enqueueCheckoutForUser', () => {
    it('creates checkout request and publishes to queue', async () => {
      const chainMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 'cr1abc', status: 'PENDING' }]),
      }
      mockInsert.mockReturnValue(chainMock)
      mockSend.mockResolvedValue(undefined)

      const result = await enqueueCheckoutForUser({
        body: {
          customerName: 'Test',
          customerEmail: 'test@example.com',
          customerAddress: '123 Main Street, City, State 12345',
          items: [{ productId: 'abc1234', quantity: 1 }],
        },
        user: testUser,
      })

      expect(result.checkoutRequestId).toBe('cr1abc')
      expect(result.status).toBe('PENDING')
      expect(mockSend).toHaveBeenCalled()
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'checkout_request_queued',
          success: true,
        })
      )
    })

    it('falls back to inline processing when queue publish fails', async () => {
      const chainMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 'cr2abcd', status: 'PENDING' }]),
      }
      mockInsert.mockReturnValue(chainMock)
      mockSend.mockRejectedValue(new Error('Queue down'))

      const result = await enqueueCheckoutForUser({
        body: {
          customerName: 'Test',
          customerEmail: 'test@example.com',
          customerAddress: '123 Main Street, City, State 12345',
          items: [{ productId: 'abc1234', quantity: 1 }],
        },
        user: testUser,
      })

      expect(result.checkoutRequestId).toBe('cr2abcd')
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'checkout_queue_publish_failed_using_inline_fallback',
        })
      )
    })

    it('throws on invalid checkout input', async () => {
      await expect(
        enqueueCheckoutForUser({
          body: { items: [] },
          user: testUser,
        })
      ).rejects.toThrow()
    })

    it('uses user name/email as defaults when body fields empty', async () => {
      const chainMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 'cr3abcd', status: 'PENDING' }]),
      }
      mockInsert.mockReturnValue(chainMock)
      mockSend.mockResolvedValue(undefined)

      await enqueueCheckoutForUser({
        body: {
          customerAddress: '123 Main Street, City, State 12345',
          items: [{ productId: 'abc1234', quantity: 1 }],
        },
        user: testUser,
      })

      expect(chainMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'Test User',
          customerEmail: 'test@example.com',
        })
      )
    })
  })

  describe('getCheckoutRequestStatusForUser', () => {
    it('throws when checkout request not found for user', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'cr1ab23',
            userId: 'other_user',
            status: 'PENDING',
          },
        ]),
      }
      mockDrizzleDbSelect.mockReturnValue(selectChain)

      await expect(
        getCheckoutRequestStatusForUser({
          checkoutRequestId: 'cr1ab23',
          userId: 'user1',
        })
      ).rejects.toThrow('Checkout request not found')
    })
  })

  describe('processCheckoutRequestById', () => {
    it('returns early when checkout request is missing', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      mockDrizzleDbSelect.mockReturnValue(selectChain)

      await processCheckoutRequestById('cr1ab23')

      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'checkout_request_missing',
          success: false,
        })
      )
    })

    it('returns early when already completed or failed', async () => {
      const checkoutSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([
            { id: 'cr1ab23', userId: 'user1', status: 'COMPLETED' },
          ]),
      }
      const orderSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue(null),
      }
      mockDrizzleDbSelect
        .mockReturnValueOnce(checkoutSelectChain)
        .mockReturnValueOnce(orderSelectChain)

      await processCheckoutRequestById('cr1ab23')

      expect(mockCreateOrderForUser).not.toHaveBeenCalled()
    })

    it('throws on invalid checkout request id', async () => {
      await expect(processCheckoutRequestById('')).rejects.toThrow()
    })
  })

  describe('getRecentCheckoutRequests', () => {
    it('returns filtered checkout requests', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'cr1',
            userId: 'user1',
            customerName: 'Test',
            customerEmail: 'test@example.com',
            customerAddress: '123 St',
            items: [{ productId: 'p1' }],
            status: 'PENDING',
            errorMessage: null,
            orderId: null,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        ]),
      }
      const fromMock = vi.fn().mockReturnValue(selectChain)
      selectChain.from = fromMock
      mockDrizzleDbSelect.mockReturnValue({ from: fromMock })

      const result = await getRecentCheckoutRequests()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cr1')
      expect(result[0].itemCount).toBe(1)
    })

    it('filters by status', async () => {
      const selectChain = {
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'cr1',
            userId: 'user1',
            customerName: 'Test',
            customerEmail: 'test@example.com',
            customerAddress: '123 St',
            items: [],
            status: 'PENDING',
            errorMessage: null,
            orderId: null,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
          {
            id: 'cr2',
            userId: 'user1',
            customerName: 'Test2',
            customerEmail: 'test2@example.com',
            customerAddress: '456 St',
            items: [],
            status: 'COMPLETED',
            errorMessage: null,
            orderId: 'ord1',
            createdAt: new Date('2024-01-02'),
            updatedAt: new Date('2024-01-02'),
          },
        ]),
      }
      mockDrizzleDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue(selectChain),
      })

      const result = await getRecentCheckoutRequests({
        status: 'PENDING',
      })

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('PENDING')
    })

    it('filters by search term', async () => {
      const selectChain = {
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'cr1',
            userId: 'user1',
            customerName: 'Alice',
            customerEmail: 'alice@example.com',
            customerAddress: '123 St',
            items: [],
            status: 'PENDING',
            errorMessage: null,
            orderId: null,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        ]),
      }
      mockDrizzleDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue(selectChain),
      })

      const result = await getRecentCheckoutRequests({ search: 'alice' })

      expect(result).toHaveLength(1)
    })
  })

  describe('recoverCheckoutRequestAfterRetryExhaustion', () => {
    it('marks as COMPLETED when order already exists', async () => {
      const orderSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ id: 'ord1' }),
      }
      mockDrizzleDbSelect.mockReturnValue(orderSelectChain)

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockUpdate.mockReturnValue(updateChain)

      await recoverCheckoutRequestAfterRetryExhaustion({
        checkoutRequestId: 'cr1',
        deliveryCount: 3,
        error: new Error('test'),
      })

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED' })
      )
    })

    it('marks as FAILED when no order exists', async () => {
      const orderSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue(null),
      }
      mockDrizzleDbSelect.mockReturnValue(orderSelectChain)

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockUpdate.mockReturnValue(updateChain)

      await recoverCheckoutRequestAfterRetryExhaustion({
        checkoutRequestId: 'cr1',
        deliveryCount: 5,
        error: new Error('Failed'),
      })

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' })
      )
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'checkout_request_retry_exhausted',
          success: false,
        })
      )
    })
  })
})
