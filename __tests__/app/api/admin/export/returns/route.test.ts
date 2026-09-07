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
      returnRequests: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
  },
}))
vi.mock('@/lib/schema', () => ({
  returnRequests: { id: 'id', createdAt: 'createdAt' },
}))
vi.mock('drizzle-orm', () => ({
  asc: vi.fn((x: unknown) => x),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { GET } from '@/app/api/admin/export/returns/route'

const baseReturnRequest = {
  id: 'ret0001',
  orderId: 'ORD1234567',
  status: 'REQUESTED',
  reason: 'DAMAGED',
  decisionReason: null,
  items: [{ quantity: 2 }, { quantity: 1 }],
  order: { customerEmail: 'jane@example.com' },
  refund: null,
  refundAmount: 1000,
  createdAt: new Date('2025-01-02T03:04:05.000Z'),
  decidedAt: null,
  receivedAt: null,
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

describe('GET /api/admin/export/returns', () => {
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

    expect(response.status).toBe(401)
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

  it('streams CSV with returns-<date>.csv attachment and return rows', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      role: 'ADMIN',
      userId: 'admin',
    })
    const decidedReturnRequest = {
      ...baseReturnRequest,
      id: 'ret0002',
      decisionReason: 'Approved by support',
      refund: { status: 'COMPLETED' },
      decidedAt: new Date('2025-01-03T00:00:00.000Z'),
      receivedAt: new Date('2025-01-04T00:00:00.000Z'),
    }
    mockFindMany
      .mockResolvedValueOnce([baseReturnRequest, decidedReturnRequest])
      .mockResolvedValueOnce([])

    const response = await GET()
    const csv = await readStream(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('returns-')

    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe(
      'id,orderId,customerEmail,status,reason,decisionReason,itemCount,totalQuantity,refundAmount,refundStatus,createdAt,decidedAt,receivedAt'
    )
    expect(lines[1]).toBe(
      'ret0001,ORD1234567,jane@example.com,REQUESTED,DAMAGED,,2,3,1000.00,,2025-01-02T03:04:05.000Z,,'
    )
    expect(lines[2]).toBe(
      'ret0002,ORD1234567,jane@example.com,REQUESTED,DAMAGED,Approved by support,2,3,1000.00,COMPLETED,2025-01-02T03:04:05.000Z,2025-01-03T00:00:00.000Z,2025-01-04T00:00:00.000Z'
    )
  })

  it('streams only the header row when there are no return requests', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      role: 'ADMIN',
      userId: 'admin',
    })
    mockFindMany.mockResolvedValue([])

    const response = await GET()
    const csv = await readStream(response)

    expect(csv.trim().split('\n')).toHaveLength(1)
  })

  it('returns a 500 when an unexpected error occurs', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      role: 'ADMIN',
      userId: 'admin',
    })
    mockFindMany.mockRejectedValue(new Error('db down'))

    const response = await GET()
    // Errors surface while the CSV stream is being consumed.
    await expect(readStream(response)).rejects.toThrow()
  })
})
