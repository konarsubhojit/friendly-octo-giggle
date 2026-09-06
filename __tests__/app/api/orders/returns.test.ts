import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockAuth,
  mockGetFeatureFlags,
  mockGetReturnEligibility,
  mockCreateReturnRequest,
  mockInvalidateUserOrderCaches,
  mockInvalidateAdminOrderCaches,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetFeatureFlags: vi.fn(),
  mockGetReturnEligibility: vi.fn(),
  mockCreateReturnRequest: vi.fn(),
  mockInvalidateUserOrderCaches: vi.fn(),
  mockInvalidateAdminOrderCaches: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

vi.mock('@/lib/edge-config', () => ({
  getFeatureFlags: mockGetFeatureFlags,
}))

vi.mock('@/lib/cache', () => ({
  invalidateUserOrderCaches: mockInvalidateUserOrderCaches,
  invalidateAdminOrderCaches: mockInvalidateAdminOrderCaches,
}))

vi.mock('@/features/orders/services/return-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/orders/services/return-service')
  >('@/features/orders/services/return-service')
  return {
    ReturnRequestError: actual.ReturnRequestError,
    getReturnEligibility: mockGetReturnEligibility,
    createReturnRequest: mockCreateReturnRequest,
  }
})

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { GET, POST } from '@/app/api/orders/[id]/returns/route'
import { ReturnRequestError } from '@/features/orders/services/return-service'

const params = Promise.resolve({ id: 'ORD1234567' })

const postRequest = (body: unknown) =>
  new NextRequest('https://localhost/api/orders/ORD1234567/returns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const getRequest = () =>
  new NextRequest('https://localhost/api/orders/ORD1234567/returns')

const validBody = {
  reason: 'DAMAGED',
  items: [{ orderItemId: 'itemAAA', quantity: 1 }],
  evidenceIds: ['evidAAA'],
}

const eligibility = {
  isReturnable: true,
  reason: null,
  deliveredAt: '2026-02-01T00:00:00.000Z',
  windowExpiresAt: '2026-02-08T00:00:00.000Z',
  items: [],
  returns: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  mockGetFeatureFlags.mockResolvedValue({ returnVideoViaInstagram: true })
  mockGetReturnEligibility.mockResolvedValue(eligibility)
  mockInvalidateUserOrderCaches.mockResolvedValue(undefined)
  mockInvalidateAdminOrderCaches.mockResolvedValue(undefined)
})

describe('GET /api/orders/[id]/returns', () => {
  it('refuses an anonymous caller', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET(getRequest(), { params })

    expect(response.status).toBe(401)
    expect(mockGetReturnEligibility).not.toHaveBeenCalled()
  })

  it('reports another customer’s order as missing, not forbidden', async () => {
    // 403 would confirm the identifier exists, turning the endpoint into an
    // oracle for enumerating order ids.
    mockGetReturnEligibility.mockRejectedValue(
      new ReturnRequestError('Order not found', 404)
    )

    const response = await GET(getRequest(), { params })

    expect(response.status).toBe(404)
  })

  it('resolves the Instagram flag server-side for the client page', async () => {
    const response = await GET(getRequest(), { params })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.instagramVideoEnabled).toBe(true)
  })

  it('never lets a user-specific response be cached', async () => {
    const response = await GET(getRequest(), { params })

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
})

describe('POST /api/orders/[id]/returns', () => {
  it('refuses an anonymous caller', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST(postRequest(validBody), { params })

    expect(response.status).toBe(401)
    expect(mockCreateReturnRequest).not.toHaveBeenCalled()
  })

  it('rejects a reason outside the damaged-item set', async () => {
    // Option B ships damaged-item returns only; a change-of-mind reason must
    // not be accepted by the schema.
    const response = await POST(
      postRequest({ ...validBody, reason: 'CHANGED_MIND' }),
      { params }
    )

    expect(response.status).toBe(400)
    expect(mockCreateReturnRequest).not.toHaveBeenCalled()
  })

  it('rejects a claim with no evidence', async () => {
    const response = await POST(
      postRequest({ ...validBody, evidenceIds: [] }),
      {
        params,
      }
    )

    expect(response.status).toBe(400)
  })

  it('rejects a claim with no items', async () => {
    const response = await POST(postRequest({ ...validBody, items: [] }), {
      params,
    })

    expect(response.status).toBe(400)
  })

  it('rejects a non-positive quantity', async () => {
    const response = await POST(
      postRequest({
        ...validBody,
        items: [{ orderItemId: 'itemAAA', quantity: 0 }],
      }),
      { params }
    )

    expect(response.status).toBe(400)
  })

  it('reports a conflicting claim with its code so the client can explain it', async () => {
    mockCreateReturnRequest.mockRejectedValue(
      new ReturnRequestError('Already returned', 409, 'FULLY_RETURNED')
    )

    const response = await POST(postRequest(validBody), { params })
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.details.code).toBe('FULLY_RETURNED')
  })

  it('creates the claim and invalidates both cache families', async () => {
    mockCreateReturnRequest.mockResolvedValue({
      id: 'r7N8p9Q',
      status: 'REQUESTED',
      refundAmount: 1200,
      createdAt: '2026-02-01T00:00:00.000Z',
    })

    const response = await POST(postRequest(validBody), { params })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.id).toBe('r7N8p9Q')
    // The claim changes the customer's order view and the admin queue.
    expect(mockInvalidateUserOrderCaches).toHaveBeenCalledWith('user-1')
    expect(mockInvalidateAdminOrderCaches).toHaveBeenCalled()
  })
})
