import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock('@/features/admin/services/admin-audit-log', () => ({
  recordAdminAuditLog: vi.fn(),
}))
vi.mock('@/features/orders/services/stock-reservation', () => ({
  releaseForCheckoutRequest: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { POST } from '@/app/api/admin/checkout-requests/[checkoutRequestId]/reservations/release/route'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { releaseForCheckoutRequest } from '@/features/orders/services/stock-reservation'
import { renderPrometheusMetrics, resetMetricsForTests } from '@/lib/metrics'

const mockCheckAdminAuth = vi.mocked(checkAdminAuth)
const mockRelease = vi.mocked(releaseForCheckoutRequest)
const mockAudit = vi.mocked(recordAdminAuditLog)

const makeRequest = (body: unknown = { reason: 'stuck request' }) =>
  new NextRequest('http://localhost/api/admin/checkout-requests/cr1/reservations/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const params = Promise.resolve({ checkoutRequestId: 'cr1abcd' })

beforeEach(() => {
  vi.clearAllMocks()
  resetMetricsForTests()
  mockCheckAdminAuth.mockResolvedValue({
    authorized: true,
    status: 200,
    userId: 'admin1',
    role: 'ADMIN',
  } as never)
  mockRelease.mockResolvedValue({ reservations: 2, quantity: 3 })
})

describe('POST /api/admin/checkout-requests/[id]/reservations/release', () => {
  it('refuses a caller without the orders:update permission', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      status: 403,
      error: 'Forbidden',
    } as never)

    const response = await POST(makeRequest(), { params })

    expect(response.status).toBe(403)
    expect(mockRelease).not.toHaveBeenCalled()
    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:update')
  })

  it('releases the hold and records who did it', async () => {
    const response = await POST(makeRequest(), { params })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { reservations: 2, quantity: 3 },
    })
    expect(mockRelease).toHaveBeenCalledWith({
      checkoutRequestId: 'cr1abcd',
      reason: 'admin:stuck request',
    })
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin1',
        entity: 'StockReservation',
        entityId: 'cr1abcd',
        action: 'release',
      })
    )
  })

  it('counts the manual release separately from automatic ones', async () => {
    await POST(makeRequest(), { params })

    expect(renderPrometheusMetrics()).toContain(
      'application_stock_reservations_total{outcome="manually_released"} 2'
    )
  })

  it('still audits a release that claimed nothing', async () => {
    mockRelease.mockResolvedValue({ reservations: 0, quantity: 0 })

    const response = await POST(makeRequest(), { params })

    expect(response.status).toBe(200)
    expect(mockAudit).toHaveBeenCalled()
    expect(renderPrometheusMetrics()).toContain(
      'application_stock_reservations_total{outcome="manually_released"} 0'
    )
  })

  it('rejects an empty reason', async () => {
    const response = await POST(makeRequest({ reason: '  ' }), { params })

    expect(response.status).toBe(400)
    expect(mockRelease).not.toHaveBeenCalled()
  })
})
