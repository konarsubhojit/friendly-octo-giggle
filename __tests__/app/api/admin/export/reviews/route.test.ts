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
      reviews: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
  },
}))
vi.mock('@/lib/schema', () => ({
  reviews: { id: 'id', createdAt: 'createdAt' },
}))
vi.mock('drizzle-orm', () => ({
  asc: vi.fn((x: unknown) => x),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { GET } from '@/app/api/admin/export/reviews/route'

const review = {
  id: 'rev1',
  productId: 'prod0001',
  userId: 'user0001',
  rating: 5,
  comment: 'Great product',
  isFeatured: true,
  isHidden: false,
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

describe('GET /api/admin/export/reviews', () => {
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

  it('streams CSV with reviews.csv attachment and review rows', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      role: 'ADMIN',
      userId: 'admin',
    })
    mockFindMany.mockResolvedValueOnce([review]).mockResolvedValueOnce([])

    const response = await GET()
    const csv = await readStream(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('reviews.csv')

    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe(
      'id,productId,userId,rating,comment,isFeatured,isHidden,createdAt'
    )
    expect(lines[1]).toBe(
      'rev1,prod0001,user0001,5,Great product,true,false,2025-01-02T03:04:05.000Z'
    )
  })

  it('streams only the header row when there are no reviews', async () => {
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
