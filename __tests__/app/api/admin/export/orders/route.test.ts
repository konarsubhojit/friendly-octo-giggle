import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCheckAdminAuth, mockFindMany } = vi.hoisted(() => ({
  mockCheckAdminAuth: vi.fn(),
  mockFindMany: vi.fn(),
}))

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))
vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      orders: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
  },
}))
vi.mock('@/lib/schema', () => ({
  orders: { id: 'id', createdAt: 'createdAt' },
}))
vi.mock('drizzle-orm', () => ({
  asc: vi.fn((x: unknown) => x),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { GET } from '@/app/api/admin/export/orders/route'

const order = {
  id: 'o1',
  customerName: 'Alice',
  customerEmail: 'a@example.com',
  totalAmount: 4200,
  status: 'PROCESSING',
  trackingNumber: 'TRK1',
  shippingProvider: 'UPS',
  createdAt: new Date('2025-01-02T03:04:05.000Z'),
}

async function readStream(response: Response): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    out += decoder.decode(value)
  }
  return out
}

describe('GET /api/admin/export/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockReset()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns 403 for non-admin users', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    })

    const response = await GET()

    expect(response.status).toBe(403)
  })

  it('streams CSV with headers and order rows for admins', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany.mockResolvedValueOnce([order]).mockResolvedValueOnce([])

    const response = await GET()
    const csv = await readStream(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('orders.csv')

    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe(
      'id,customerName,customerEmail,totalAmount,status,trackingNumber,shippingProvider,createdAt'
    )
    expect(lines[1]).toBe(
      'o1,Alice,a@example.com,4200,PROCESSING,TRK1,UPS,2025-01-02T03:04:05.000Z'
    )
  })

  it('streams only the header row when there are no orders', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany.mockResolvedValue([])

    const response = await GET()
    const csv = await readStream(response)

    expect(response.status).toBe(200)
    expect(csv.trim().split('\n')).toHaveLength(1)
  })

  it('escapes commas and quotes in customer fields', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany
      .mockResolvedValueOnce([
        { ...order, customerName: 'Doe, John', customerEmail: 'a"b@x.com' },
      ])
      .mockResolvedValueOnce([])

    const response = await GET()
    const csv = await readStream(response)

    expect(csv).toContain('"Doe, John"')
    expect(csv).toContain('"a""b@x.com"')
  })
})
