import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockAuth,
  mockGetFailedEmails,
  mockAcknowledgePendingEmails,
  mockBatchRetry,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetFailedEmails: vi.fn(),
  mockAcknowledgePendingEmails: vi.fn().mockResolvedValue(undefined),
  mockBatchRetry: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/email/failed-emails', () => ({
  getFailedEmails: mockGetFailedEmails,
  acknowledgePendingEmails: mockAcknowledgePendingEmails,
  batchRetryFailedEmails: mockBatchRetry,
}))
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

const adminSession = {
  user: { id: 'admin1', role: 'ADMIN', name: 'Admin', email: 'admin@test.com' },
}
const customerSession = { user: { id: 'cust1', role: 'CUSTOMER' } }

const makeRequest = (method: string, url: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }
      : {}),
  })

describe('GET /api/admin/email-failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/admin/email-failures/route')
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/admin/email-failures')
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    mockAuth.mockResolvedValue(customerSession)
    vi.resetModules()
    const { GET } = await import('@/app/api/admin/email-failures/route')
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/admin/email-failures')
    )
    expect(res.status).toBe(403)
  })

  it('returns paginated records for admin', async () => {
    mockAuth.mockResolvedValue(adminSession)
    mockGetFailedEmails.mockResolvedValue({
      records: [{ id: 'abc1234', status: 'failed' }],
      total: 1,
    })
    vi.resetModules()
    const { GET } = await import('@/app/api/admin/email-failures/route')
    const res = await GET(
      makeRequest(
        'GET',
        'http://localhost/api/admin/email-failures?page=1&pageSize=25'
      )
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.records).toHaveLength(1)
    expect(data.data.pagination.total).toBe(1)
  })

  it('returns 400 for invalid query params', async () => {
    mockAuth.mockResolvedValue(adminSession)
    vi.resetModules()
    const { GET } = await import('@/app/api/admin/email-failures/route')
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/admin/email-failures?page=0')
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/admin/email-failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    vi.resetModules()
    const { POST } = await import('@/app/api/admin/email-failures/route')
    const res = await POST(
      makeRequest('POST', 'http://localhost/api/admin/email-failures', {
        ids: ['abc1234'],
      })
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    mockAuth.mockResolvedValue(customerSession)
    vi.resetModules()
    const { POST } = await import('@/app/api/admin/email-failures/route')
    const res = await POST(
      makeRequest('POST', 'http://localhost/api/admin/email-failures', {
        ids: ['abc1234'],
      })
    )
    expect(res.status).toBe(403)
  })

  it('returns retry results for admin', async () => {
    mockAuth.mockResolvedValue(adminSession)
    mockBatchRetry.mockResolvedValue([{ id: 'abc1234', success: true }])
    vi.resetModules()
    const { POST } = await import('@/app/api/admin/email-failures/route')
    const res = await POST(
      makeRequest('POST', 'http://localhost/api/admin/email-failures', {
        ids: ['abc1234'],
      })
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.results[0].success).toBe(true)
  })

  it('returns 400 for empty ids array', async () => {
    mockAuth.mockResolvedValue(adminSession)
    vi.resetModules()
    const { POST } = await import('@/app/api/admin/email-failures/route')
    const res = await POST(
      makeRequest('POST', 'http://localhost/api/admin/email-failures', {
        ids: [],
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid id format', async () => {
    mockAuth.mockResolvedValue(adminSession)
    vi.resetModules()
    const { POST } = await import('@/app/api/admin/email-failures/route')
    const res = await POST(
      makeRequest('POST', 'http://localhost/api/admin/email-failures', {
        ids: ['not-valid-id!!!'],
      })
    )
    expect(res.status).toBe(400)
  })
})
