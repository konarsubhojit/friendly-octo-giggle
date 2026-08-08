import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckAdminAuth, mockDecideReturn, mockInvalidateAdminOrderCaches } =
  vi.hoisted(() => ({
    mockCheckAdminAuth: vi.fn(),
    mockDecideReturn: vi.fn(),
    mockInvalidateAdminOrderCaches: vi.fn(),
  }))

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/features/orders/services/return-admin-service', () => ({
  decideReturn: mockDecideReturn,
}))

vi.mock('@/lib/cache', () => ({
  invalidateAdminOrderCaches: mockInvalidateAdminOrderCaches,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { PATCH } from '@/app/api/admin/returns/[id]/route'
import { ReturnTransitionError } from '@/features/orders/services/return-state-machine'
import { ReturnRequestError } from '@/features/orders/services/return-service'

const params = Promise.resolve({ id: 'r7N8p9Q' })

const patchRequest = (body: unknown) =>
  new NextRequest('https://localhost/api/admin/returns/r7N8p9Q', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckAdminAuth.mockResolvedValue({
    authorized: true,
    userId: 'admin-1',
    role: 'ADMIN',
  })
  mockDecideReturn.mockResolvedValue({
    id: 'r7N8p9Q',
    status: 'APPROVED',
    restocked: false,
    refund: null,
  })
  mockInvalidateAdminOrderCaches.mockResolvedValue(undefined)
})

describe('PATCH /api/admin/returns/[id]', () => {
  it('refuses an unauthenticated caller', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    })

    const response = await PATCH(
      patchRequest({ action: 'approve', decisionReason: 'Photos clear' }),
      { params }
    )

    expect(response.status).toBe(401)
    expect(mockDecideReturn).not.toHaveBeenCalled()
  })

  it('refuses a staff account lacking orders:returns', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Forbidden',
      status: 403,
    })

    const response = await PATCH(
      patchRequest({ action: 'approve', decisionReason: 'Photos clear' }),
      { params }
    )

    expect(response.status).toBe(403)
  })

  it('gates triage on orders:returns', async () => {
    await PATCH(
      patchRequest({ action: 'approve', decisionReason: 'Photos clear' }),
      { params }
    )

    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:returns')
  })

  it('gates the refund action on orders:refund, not orders:returns', async () => {
    // Moving money is a stricter boundary than triaging a claim.
    await PATCH(patchRequest({ action: 'refund' }), { params })

    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:refund')
  })

  it('gates the settle action on orders:refund', async () => {
    await PATCH(patchRequest({ action: 'settle' }), { params })

    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:refund')
  })

  it('rejects an approve with no decision reason', async () => {
    const response = await PATCH(patchRequest({ action: 'approve' }), {
      params,
    })

    expect(response.status).toBe(400)
    expect(mockDecideReturn).not.toHaveBeenCalled()
  })

  it('rejects a reject with no decision reason', async () => {
    const response = await PATCH(patchRequest({ action: 'reject' }), { params })

    expect(response.status).toBe(400)
  })

  it('rejects an unknown action', async () => {
    const response = await PATCH(patchRequest({ action: 'incinerate' }), {
      params,
    })

    expect(response.status).toBe(400)
  })

  it('reports an illegal transition as 409 with the current state', async () => {
    mockDecideReturn.mockRejectedValue(
      new ReturnTransitionError('REFUNDED', 'approve')
    )

    const response = await PATCH(
      patchRequest({ action: 'approve', decisionReason: 'Photos clear' }),
      { params }
    )
    const payload = await response.json()

    expect(response.status).toBe(409)
    // The client re-renders from the returned state rather than guessing.
    expect(payload.details.currentStatus).toBe('REFUNDED')
  })

  it('reports a missing return as 404', async () => {
    mockDecideReturn.mockRejectedValue(
      new ReturnRequestError('Return not found', 404)
    )

    const response = await PATCH(
      patchRequest({ action: 'approve', decisionReason: 'Photos clear' }),
      { params }
    )

    expect(response.status).toBe(404)
  })

  it('records the decision and invalidates the admin caches', async () => {
    const response = await PATCH(
      patchRequest({ action: 'approve', decisionReason: 'Photos clear' }),
      { params }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.status).toBe('APPROVED')
    expect(mockDecideReturn).toHaveBeenCalledWith(
      'r7N8p9Q',
      'approve',
      { userId: 'admin-1', role: 'ADMIN' },
      'Photos clear'
    )
    expect(mockInvalidateAdminOrderCaches).toHaveBeenCalledWith('r7N8p9Q')
  })

  it('never lets an admin decision response be cached', async () => {
    const response = await PATCH(
      patchRequest({ action: 'approve', decisionReason: 'Photos clear' }),
      { params }
    )

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
