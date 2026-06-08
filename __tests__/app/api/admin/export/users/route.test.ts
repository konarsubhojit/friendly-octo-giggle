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
      users: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
  },
}))
vi.mock('@/lib/schema', () => ({
  users: { id: 'id', createdAt: 'createdAt' },
}))
vi.mock('drizzle-orm', () => ({
  asc: vi.fn((x: unknown) => x),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { GET } from '@/app/api/admin/export/users/route'

const user = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'USER',
  currencyPreference: 'USD',
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

describe('GET /api/admin/export/users', () => {
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

  it('streams CSV with users.csv attachment and user rows', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany.mockResolvedValueOnce([user]).mockResolvedValueOnce([])

    const response = await GET()
    const csv = await readStream(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('users.csv')

    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('id,name,email,role,currencyPreference,createdAt')
    expect(lines[1]).toBe(
      'u1,Alice,alice@example.com,USER,USD,2025-01-02T03:04:05.000Z'
    )
  })

  it('streams only the header row when there are no users', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany.mockResolvedValue([])

    const response = await GET()
    const csv = await readStream(response)

    expect(csv.trim().split('\n')).toHaveLength(1)
  })
})
