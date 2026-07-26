import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDbCoupons } = vi.hoisted(() => ({
  mockDbCoupons: {
    findAll: vi.fn(),
    findManyByCodes: vi.fn(),
    create: vi.fn(),
    countRedemptions: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    redemptionSummary: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: { coupons: mockDbCoupons } }))
vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock('@/features/admin/services/admin-audit-log', () => ({
  recordAdminAuditLog: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { GET, POST } from '@/app/api/admin/coupons/route'
import { PATCH, DELETE } from '@/app/api/admin/coupons/[id]/route'
import { GET as GET_REDEMPTIONS } from '@/app/api/admin/coupons/redemptions/route'

const now = new Date('2026-01-01T00:00:00.000Z')

const couponRow = {
  id: 'cpn0001',
  code: 'SAVE10',
  description: null,
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
  createdAt: now,
  updatedAt: now,
}

const validPayload = {
  code: 'SAVE10',
  discountType: 'PERCENTAGE',
  discountValue: 10,
}

const buildRequest = (body: unknown, method = 'POST') =>
  new NextRequest('http://localhost/api/admin/coupons', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

const params = { params: Promise.resolve({ id: 'cpn0001' }) }

describe('admin coupon routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(checkAdminAuth as unknown as Mock).mockResolvedValue({
      authorized: true,
      userId: 'usr-admin',
    })
  })

  it('rejects unauthorized callers', async () => {
    ;(checkAdminAuth as unknown as Mock).mockResolvedValue({
      authorized: false,
      error: 'Forbidden',
      status: 403,
    })

    expect((await GET()).status).toBe(403)
    expect((await POST(buildRequest(validPayload))).status).toBe(403)
    expect((await GET_REDEMPTIONS()).status).toBe(403)
  })

  it('lists coupons', async () => {
    mockDbCoupons.findAll.mockResolvedValue([couponRow])

    const json = await (await GET()).json()

    expect(json.data.coupons).toHaveLength(1)
    expect(json.data.coupons[0]).toMatchObject({
      id: 'cpn0001',
      code: 'SAVE10',
    })
  })

  it('creates a coupon', async () => {
    mockDbCoupons.findManyByCodes.mockResolvedValue([])
    mockDbCoupons.create.mockResolvedValue(couponRow)

    const response = await POST(buildRequest(validPayload))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data.coupon.code).toBe('SAVE10')
    expect(mockDbCoupons.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SAVE10', discountType: 'PERCENTAGE' })
    )
  })

  it('rejects a duplicate code with 409', async () => {
    mockDbCoupons.findManyByCodes.mockResolvedValue([couponRow])

    const response = await POST(buildRequest(validPayload))

    expect(response.status).toBe(409)
    expect(mockDbCoupons.create).not.toHaveBeenCalled()
  })

  it('rejects an invalid payload', async () => {
    const response = await POST(
      buildRequest({ ...validPayload, discountValue: -5 })
    )

    expect(response.status).toBe(400)
  })

  it('requires a discount value for percentage coupons', async () => {
    const response = await POST(
      buildRequest({ code: 'SAVE10', discountType: 'PERCENTAGE' })
    )

    expect(response.status).toBe(400)
  })

  it('updates a coupon', async () => {
    mockDbCoupons.update.mockResolvedValue({ ...couponRow, isActive: false })

    const response = await PATCH(
      buildRequest({ isActive: false }, 'PATCH'),
      params
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.coupon.isActive).toBe(false)
    expect(mockDbCoupons.update).toHaveBeenCalledWith('cpn0001', {
      isActive: false,
    })
  })

  it('returns 404 when updating a missing coupon', async () => {
    mockDbCoupons.update.mockResolvedValue(null)

    const response = await PATCH(buildRequest({ isActive: false }, 'PATCH'), {
      params: Promise.resolve({ id: 'missing' }),
    })

    expect(response.status).toBe(404)
  })

  it('deletes a coupon', async () => {
    mockDbCoupons.countRedemptions.mockResolvedValue(0)
    mockDbCoupons.delete.mockResolvedValue({ id: 'cpn0001' })

    const response = await DELETE(buildRequest({}, 'DELETE'), params)

    expect(response.status).toBe(200)
    expect(mockDbCoupons.delete).toHaveBeenCalledWith('cpn0001')
  })

  it('refuses to delete a coupon that has been redeemed', async () => {
    mockDbCoupons.countRedemptions.mockResolvedValue(3)

    const response = await DELETE(buildRequest({}, 'DELETE'), params)

    expect(response.status).toBe(409)
    expect(mockDbCoupons.delete).not.toHaveBeenCalled()
  })

  it('returns 404 when deleting a missing coupon', async () => {
    mockDbCoupons.countRedemptions.mockResolvedValue(0)
    mockDbCoupons.delete.mockResolvedValue(null)

    const response = await DELETE(buildRequest({}, 'DELETE'), params)

    expect(response.status).toBe(404)
  })

  it('reports redemptions', async () => {
    mockDbCoupons.redemptionSummary.mockResolvedValue([
      {
        couponId: 'cpn0001',
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        isActive: true,
        usageLimit: 10,
        usageCount: 2,
        redemptionCount: '2',
        totalDiscount: '45.50',
        lastRedeemedAt: now,
      },
    ])

    const json = await (await GET_REDEMPTIONS()).json()

    expect(json.data.redemptions[0]).toMatchObject({
      code: 'SAVE10',
      redemptionCount: 2,
      totalDiscount: 45.5,
      lastRedeemedAt: now.toISOString(),
    })
  })
})
