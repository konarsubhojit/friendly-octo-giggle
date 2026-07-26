import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDbCarts, mockDbCoupons } = vi.hoisted(() => ({
  mockDbCarts: { findWithRelationsByUserId: vi.fn() },
  mockDbCoupons: { findManyByCodes: vi.fn(), countUserRedemptions: vi.fn() },
}))

vi.mock('@/lib/db', () => ({
  db: { carts: mockDbCarts, coupons: mockDbCoupons },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { auth } from '@/lib/auth'
import { POST } from '@/app/api/cart/coupon/route'

const buildRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/cart/coupon', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

const cartWithItems = {
  id: 'cart001',
  items: [
    {
      productId: 'prd0001',
      quantity: 2,
      product: { category: 'cat-a' },
      variant: { price: 100 },
    },
  ],
}

const couponRow = {
  id: 'cpn0001',
  code: 'SAVE10',
  discountType: 'PERCENTAGE' as const,
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
}

describe('POST /api/cart/coupon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as unknown as Mock).mockResolvedValue({ user: { id: 'usr0001' } })
    mockDbCoupons.countUserRedemptions.mockResolvedValue({})
  })

  it('returns 401 when not signed in', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)

    const response = await POST(buildRequest({ couponCode: 'SAVE10' }))

    expect(response.status).toBe(401)
  })

  it('returns 400 for an invalid body', async () => {
    const response = await POST(buildRequest({ couponCode: '' }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when the cart is empty', async () => {
    mockDbCarts.findWithRelationsByUserId.mockResolvedValue({
      id: 'cart001',
      items: [],
    })

    const response = await POST(buildRequest({ couponCode: 'SAVE10' }))

    expect(response.status).toBe(400)
  })

  it('returns the recomputed discount for a valid coupon', async () => {
    mockDbCarts.findWithRelationsByUserId.mockResolvedValue(cartWithItems)
    mockDbCoupons.findManyByCodes.mockResolvedValue([couponRow])

    const response = await POST(buildRequest({ couponCode: 'save10' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toMatchObject({
      subtotal: 200,
      discountAmount: 20,
      total: 180,
    })
  })

  it('surfaces the coupon error status for an unknown code', async () => {
    mockDbCarts.findWithRelationsByUserId.mockResolvedValue(cartWithItems)
    mockDbCoupons.findManyByCodes.mockResolvedValue([])

    const response = await POST(buildRequest({ couponCode: 'NOPE12' }))

    expect(response.status).toBe(404)
  })

  it('rejects an expired coupon', async () => {
    mockDbCarts.findWithRelationsByUserId.mockResolvedValue(cartWithItems)
    mockDbCoupons.findManyByCodes.mockResolvedValue([
      { ...couponRow, endsAt: new Date('2020-01-01') },
    ])

    const response = await POST(buildRequest({ couponCode: 'SAVE10' }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/expired/)
  })
})
