import { describe, it, expect, vi, beforeEach } from 'vitest'

const productsFindManyMock = vi.hoisted(() => vi.fn())
const reviewsFindManyMock = vi.hoisted(() => vi.fn())
const ordersFindManyMock = vi.hoisted(() => vi.fn())
const ordersFindFirstMock = vi.hoisted(() => vi.fn())
const getShippingConfigMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: { findMany: productsFindManyMock },
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
  extractComparisonTerms,
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
    productsFindManyMock.mockResolvedValue([])
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

  describe('extractComparisonTerms', () => {
    it('splits on comparison connectives', () => {
      expect(extractComparisonTerms('compare mug vs tumbler', 'Mug')).toEqual([
        'mug',
        'tumbler',
      ])
    })

    it('falls back to the current product name', () => {
      expect(extractComparisonTerms('compare', 'Mug')).toEqual(['Mug'])
    })
  })

  describe('buildCommerceContext dispatch', () => {
    it('returns no sections when no intent is detected', async () => {
      const sections = await buildCommerceContext(baseParams)
      expect(sections).toEqual([])
      expect(productsFindManyMock).not.toHaveBeenCalled()
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

    it('builds a comparison section when multiple products match', async () => {
      productsFindManyMock.mockResolvedValue([
        { id: 'p1', name: 'Ceramic Mug', variants: [{ price: 500, stock: 9 }] },
        {
          id: 'p2',
          name: 'Steel Tumbler',
          variants: [{ price: 900, stock: 0 }],
        },
      ])

      const sections = await buildCommerceContext({
        ...baseParams,
        messageText: 'compare mug vs tumbler',
        intents: { ...noIntents, wantsComparison: true },
      })

      expect(sections[0]).toContain('Comparison candidates:')
      expect(sections[0]).toContain('- Ceramic Mug: INR500 (INR), In Stock')
      expect(sections[0]).toContain(
        '- Steel Tumbler: INR900 (INR), Out of Stock'
      )
    })

    it('omits the comparison section when only one product matches', async () => {
      productsFindManyMock.mockResolvedValue([
        { id: 'p1', name: 'Ceramic Mug', variants: [{ price: 500, stock: 9 }] },
      ])

      const sections = await buildCommerceContext({
        ...baseParams,
        messageText: 'compare mug vs tumbler',
        intents: { ...noIntents, wantsComparison: true },
      })

      expect(sections).toEqual([])
    })

    it('recommends cheaper same-category products within budget', async () => {
      productsFindManyMock.mockResolvedValue([
        { id: 'p1', name: 'Ceramic Mug', variants: [{ price: 500, stock: 9 }] },
        { id: 'p2', name: 'Budget Mug', variants: [{ price: 200, stock: 2 }] },
        { id: 'p3', name: 'Luxury Mug', variants: [{ price: 5000, stock: 4 }] },
      ])

      const sections = await buildCommerceContext({
        ...baseParams,
        messageText: 'recommend something under 400',
        intents: { ...noIntents, wantsRecommendation: true },
      })

      expect(sections[0]).toContain('Recommendations under INR400 (INR):')
      expect(sections[0]).toContain('- Budget Mug: INR200, Low Stock')
      expect(sections[0]).not.toContain('Luxury Mug')
      expect(sections[0]).not.toContain('Ceramic Mug')
    })

    it('reports when no alternatives fit the budget', async () => {
      productsFindManyMock.mockResolvedValue([
        { id: 'p9', name: 'Luxury Mug', variants: [{ price: 5000, stock: 4 }] },
      ])

      const sections = await buildCommerceContext({
        ...baseParams,
        messageText: 'anything under 400',
        intents: { ...noIntents, wantsRecommendation: true },
      })

      expect(sections[0]).toBe(
        'No same-category alternatives were found under INR400 (INR).'
      )
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
