import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindManyByCodes = vi.fn()
const mockCountUserRedemptions = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    coupons: {
      findManyByCodes: (...args: unknown[]) => mockFindManyByCodes(...args),
      countUserRedemptions: (...args: unknown[]) =>
        mockCountUserRedemptions(...args),
    },
  },
}))

import {
  CouponError,
  calculateSubtotal,
  computeCouponDiscount,
  evaluateCoupons,
  isCouponError,
  normalizeCouponCode,
  resolveCartDiscount,
  type CouponRecord,
  type DiscountCartItem,
} from '@/features/cart/services/coupon-service'

const buildCoupon = (overrides: Partial<CouponRecord> = {}): CouponRecord => ({
  id: 'cpn0001',
  code: 'SAVE10',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  maxDiscountAmount: null,
  minCartValue: 0,
  scopedCategories: [],
  scopedProductIds: [],
  usageLimit: null,
  perUserLimit: null,
  usageCount: 0,
  stackable: true,
  isActive: true,
  startsAt: null,
  endsAt: null,
  ...overrides,
})

const items: DiscountCartItem[] = [
  { productId: 'prd0001', category: 'cat-a', quantity: 2, unitPrice: 100 },
  { productId: 'prd0002', category: 'cat-b', quantity: 1, unitPrice: 50 },
]

describe('coupon-service', () => {
  describe('normalizeCouponCode', () => {
    it('trims and upper-cases codes', () => {
      expect(normalizeCouponCode('  save10 ')).toBe('SAVE10')
    })
  })

  describe('calculateSubtotal', () => {
    it('sums quantity times unit price', () => {
      expect(calculateSubtotal(items)).toBe(250)
    })
  })

  describe('computeCouponDiscount', () => {
    it('computes a percentage discount', () => {
      expect(computeCouponDiscount({ coupon: buildCoupon(), items })).toBe(25)
    })

    it('caps a percentage discount at maxDiscountAmount', () => {
      const coupon = buildCoupon({ discountValue: 50, maxDiscountAmount: 30 })
      expect(computeCouponDiscount({ coupon, items })).toBe(30)
    })

    it('clamps a fixed discount to the eligible subtotal', () => {
      const coupon = buildCoupon({
        discountType: 'FIXED_AMOUNT',
        discountValue: 1000,
      })
      expect(computeCouponDiscount({ coupon, items })).toBe(250)
    })

    it('discounts shipping for free shipping coupons', () => {
      const coupon = buildCoupon({
        discountType: 'FREE_SHIPPING',
        discountValue: 0,
      })
      expect(computeCouponDiscount({ coupon, items, shippingAmount: 40 })).toBe(
        40
      )
    })

    it('makes every second eligible unit free for BOGO', () => {
      const coupon = buildCoupon({ discountType: 'BOGO', discountValue: 0 })
      expect(computeCouponDiscount({ coupon, items })).toBe(100)
    })

    it('only discounts items inside the coupon scope', () => {
      const coupon = buildCoupon({
        discountType: 'FIXED_AMOUNT',
        discountValue: 1000,
        scopedCategories: ['cat-b'],
      })
      expect(computeCouponDiscount({ coupon, items })).toBe(50)
    })

    it('matches product scope as well as category scope', () => {
      const coupon = buildCoupon({
        discountType: 'FIXED_AMOUNT',
        discountValue: 1000,
        scopedProductIds: ['prd0001'],
      })
      expect(computeCouponDiscount({ coupon, items })).toBe(200)
    })
  })

  describe('evaluateCoupons', () => {
    it('returns an untouched total when no codes are supplied', () => {
      const result = evaluateCoupons({
        codes: [],
        coupons: [],
        items,
        shippingAmount: 10,
      })

      expect(result).toMatchObject({
        subtotal: 250,
        discountAmount: 0,
        total: 260,
        appliedCoupons: [],
      })
    })

    it('applies a matching coupon case-insensitively', () => {
      const result = evaluateCoupons({
        codes: ['save10'],
        coupons: [buildCoupon()],
        items,
      })

      expect(result.discountAmount).toBe(25)
      expect(result.total).toBe(225)
      expect(result.appliedCoupons).toHaveLength(1)
      expect(result.appliedCoupons[0]).toMatchObject({
        couponId: 'cpn0001',
        code: 'SAVE10',
        discountAmount: 25,
      })
    })

    it('rejects an unknown code with a 404 status', () => {
      expect(() =>
        evaluateCoupons({ codes: ['NOPE'], coupons: [], items })
      ).toThrow(CouponError)

      try {
        evaluateCoupons({ codes: ['NOPE'], coupons: [], items })
      } catch (error) {
        expect(isCouponError(error)).toBe(true)
        expect((error as CouponError).status).toBe(404)
      }
    })

    it('rejects an inactive coupon', () => {
      expect(() =>
        evaluateCoupons({
          codes: ['SAVE10'],
          coupons: [buildCoupon({ isActive: false })],
          items,
        })
      ).toThrow(/no longer active/)
    })

    it('rejects a coupon outside its validity window', () => {
      const now = new Date('2026-01-10T00:00:00.000Z')

      expect(() =>
        evaluateCoupons({
          codes: ['SAVE10'],
          coupons: [buildCoupon({ startsAt: new Date('2026-02-01') })],
          items,
          now,
        })
      ).toThrow(/not valid yet/)

      expect(() =>
        evaluateCoupons({
          codes: ['SAVE10'],
          coupons: [buildCoupon({ endsAt: new Date('2026-01-01') })],
          items,
          now,
        })
      ).toThrow(/expired/)
    })

    it('rejects a coupon below the minimum cart value', () => {
      expect(() =>
        evaluateCoupons({
          codes: ['SAVE10'],
          coupons: [buildCoupon({ minCartValue: 500 })],
          items,
        })
      ).toThrow(/minimum cart value/)
    })

    it('rejects a coupon that reached its global usage limit', () => {
      expect(() =>
        evaluateCoupons({
          codes: ['SAVE10'],
          coupons: [buildCoupon({ usageLimit: 5, usageCount: 5 })],
          items,
        })
      ).toThrow(/redemption limit/)
    })

    it('rejects a coupon that reached its per-user limit', () => {
      expect(() =>
        evaluateCoupons({
          codes: ['SAVE10'],
          coupons: [buildCoupon({ perUserLimit: 1 })],
          items,
          userRedemptionCounts: { cpn0001: 1 },
        })
      ).toThrow(/already been used/)
    })

    it('rejects stacking when a coupon is not stackable', () => {
      expect(() =>
        evaluateCoupons({
          codes: ['SAVE10', 'SOLO'],
          coupons: [
            buildCoupon(),
            buildCoupon({ id: 'cpn0002', code: 'SOLO', stackable: false }),
          ],
          items,
        })
      ).toThrow(/cannot be combined/)
    })

    it('stacks two stackable coupons without going negative', () => {
      const result = evaluateCoupons({
        codes: ['BIG1', 'BIG2'],
        coupons: [
          buildCoupon({
            id: 'cpn0001',
            code: 'BIG1',
            discountType: 'FIXED_AMOUNT',
            discountValue: 200,
          }),
          buildCoupon({
            id: 'cpn0002',
            code: 'BIG2',
            discountType: 'FIXED_AMOUNT',
            discountValue: 200,
          }),
        ],
        items,
      })

      expect(result.discountAmount).toBe(250)
      expect(result.total).toBe(0)
    })

    it('keeps shipping discounts separate from item discounts', () => {
      const result = evaluateCoupons({
        codes: ['SHIPFREE'],
        coupons: [
          buildCoupon({
            code: 'SHIPFREE',
            discountType: 'FREE_SHIPPING',
            discountValue: 0,
          }),
        ],
        items,
        shippingAmount: 40,
      })

      expect(result.discountAmount).toBe(40)
      expect(result.shippingAmount).toBe(0)
      expect(result.total).toBe(250)
      expect(result.appliedCoupons[0].freeShipping).toBe(true)
    })

    it('deduplicates repeated codes', () => {
      const result = evaluateCoupons({
        codes: ['SAVE10', 'save10'],
        coupons: [buildCoupon()],
        items,
      })

      expect(result.appliedCoupons).toHaveLength(1)
    })

    it('rejects more than the maximum number of codes', () => {
      expect(() =>
        evaluateCoupons({
          codes: ['A', 'B', 'C', 'D', 'E', 'F'],
          coupons: [],
          items,
        })
      ).toThrow(/At most/)
    })
  })

  describe('resolveCartDiscount', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('short-circuits without hitting the database when no code is given', async () => {
      const result = await resolveCartDiscount({
        codes: [],
        items,
        userId: 'usr0001',
      })

      expect(result.discountAmount).toBe(0)
      expect(result.total).toBe(250)
      expect(mockFindManyByCodes).not.toHaveBeenCalled()
    })

    it('loads coupons and prior redemptions before evaluating', async () => {
      mockFindManyByCodes.mockResolvedValue([
        {
          ...buildCoupon(),
          createdAt: new Date(),
          updatedAt: new Date(),
          name: 'Ten off',
          description: null,
        },
      ])
      mockCountUserRedemptions.mockResolvedValue({})

      const result = await resolveCartDiscount({
        codes: ['save10'],
        items,
        userId: 'usr0001',
      })

      expect(mockFindManyByCodes).toHaveBeenCalledWith(['SAVE10'])
      expect(mockCountUserRedemptions).toHaveBeenCalledWith('usr0001', [
        'cpn0001',
      ])
      expect(result.discountAmount).toBe(25)
    })
  })
})
