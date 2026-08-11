import { describe, it, expect, vi, beforeEach } from 'vitest'

const productsFindManyMock = vi.hoisted(() => vi.fn())
const reviewsFindManyMock = vi.hoisted(() => vi.fn())
const ordersFindManyMock = vi.hoisted(() => vi.fn())
const ordersFindFirstMock = vi.hoisted(() => vi.fn())
const getShippingConfigMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      reviews: { findMany: reviewsFindManyMock },
      orders: {
        findMany: ordersFindManyMock,
        findFirst: ordersFindFirstMock,
      },
    },
  },
}))

vi.mock('@/lib/edge-config', () => ({
  getShippingConfig: getShippingConfigMock,
}))

import {
  buildCommerceContext,
  fetchOrderStatusContext,
  fetchReviewSummaryContext,
  toStockLabel,
} from '@/features/ai/services/chat-commerce-context'
import type { IntentSignals } from '@/features/ai/services/chat-types'
import type { Product } from '@/lib/types'

const product = {
  id: 'p1',
  name: 'Ceramic Mug',
  category: 'kitchen',
} as unknown as Product

const formatPrice = (price: number) => `INR${price}`

const noIntents: IntentSignals = {
  wantsComparison: false,
  wantsRecommendation: false,
  wantsDeliveryInfo: false,
  wantsOrderStatus: false,
  wantsReviewSummary: false,
}

const baseParams = {
  product,
  userId: 'user-1',
  isAuthenticated: true,
  messageText: '',
  currencyCode: 'INR' as const,
  formatPrice,
  intents: noIntents,
}

describe('chat-commerce-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getShippingConfigMock.mockResolvedValue({ estimatedDeliveryDays: 5 })
    reviewsFindManyMock.mockResolvedValue([])
    ordersFindManyMock.mockResolvedValue([])
    ordersFindFirstMock.mockResolvedValue(undefined)
  })

  describe('toStockLabel', () => {
    it('maps stock counts to coarse labels', () => {
      expect(toStockLabel(10)).toBe('In Stock')
      expect(toStockLabel(3)).toBe('Low Stock')
      expect(toStockLabel(0)).toBe('Out of Stock')
    })
  })

  describe('buildCommerceContext dispatch', () => {
    it('returns no sections when no intent is detected', async () => {
      const sections = await buildCommerceContext(baseParams)
      expect(sections).toEqual([])
      expect(reviewsFindManyMock).not.toHaveBeenCalled()
      expect(getShippingConfigMock).not.toHaveBeenCalled()
    })

    it('includes the shipping estimate for delivery intent', async () => {
      const sections = await buildCommerceContext({
        ...baseParams,
        intents: { ...noIntents, wantsDeliveryInfo: true },
      })
      expect(sections).toEqual([
        'Estimated delivery: approximately 5 business days (standard shipping).',
      ])
    })

    it('prompts guests to sign in for order status', async () => {
      const sections = await buildCommerceContext({
        ...baseParams,
        isAuthenticated: false,
        messageText: 'where is my order',
        intents: { ...noIntents, wantsOrderStatus: true },
      })

      expect(sections).toEqual([
        'Sign in to check your recent orders and tracking details for your account.',
      ])
      expect(ordersFindManyMock).not.toHaveBeenCalled()
    })
  })

  describe('fetchReviewSummaryContext', () => {
    it('returns a placeholder when there are no reviews', async () => {
      await expect(fetchReviewSummaryContext('p1')).resolves.toBe(
        'No customer reviews are available for this product yet.'
      )
    })

    it('summarizes ratings and recent comments', async () => {
      reviewsFindManyMock.mockResolvedValue([
        { rating: 5, comment: 'Great mug', createdAt: new Date() },
        { rating: 3, comment: '  ', createdAt: new Date() },
      ])

      const summary = await fetchReviewSummaryContext('p1')
      expect(summary).toContain('2 recent reviews, average rating 4.0/5')
      expect(summary).toContain('1 positive ratings')
      expect(summary).toContain('- Great mug')
    })

    it('truncates long comments', async () => {
      reviewsFindManyMock.mockResolvedValue([
        { rating: 5, comment: 'a'.repeat(200), createdAt: new Date() },
      ])

      const summary = await fetchReviewSummaryContext('p1')
      expect(summary).toContain(`${'a'.repeat(120)}...`)
    })
  })

  describe('fetchOrderStatusContext', () => {
    it('looks up a specific order id when present', async () => {
      ordersFindFirstMock.mockResolvedValue({
        id: 'ORD1234',
        status: 'SHIPPED',
        trackingNumber: 'TRK1',
        shippingProvider: 'BlueDart',
      })

      await expect(
        fetchOrderStatusContext('user-1', 'status of ORD1234')
      ).resolves.toBe(
        'Order ORD1234: SHIPPED, tracking TRK1, carrier BlueDart.'
      )
    })

    it('reports a missing order for the account', async () => {
      await expect(
        fetchOrderStatusContext('user-1', 'status of ORD1234')
      ).resolves.toBe('No order with ID "ORD1234" was found for this account.')
    })

    it('lists recent orders when no id is given', async () => {
      ordersFindManyMock.mockResolvedValue([
        {
          id: 'ORD1',
          status: 'PENDING',
          trackingNumber: null,
          shippingProvider: null,
        },
      ])

      await expect(fetchOrderStatusContext('user-1', 'my order')).resolves.toBe(
        'Recent order status:\n- ORD1: PENDING, tracking not available, carrier not assigned'
      )
    })

    it('reports when the account has no orders', async () => {
      await expect(fetchOrderStatusContext('user-1', 'my order')).resolves.toBe(
        'No orders were found for this account yet.'
      )
    })
  })
})
