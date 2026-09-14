import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockSelectWhere = vi.hoisted(() => vi.fn())
const mockOrderCountsWhere = vi.hoisted(() => vi.fn())
const mockOrderCountsGroupBy = vi.hoisted(() => vi.fn())
const mockSelectFrom = vi.hoisted(() =>
  vi.fn((table) =>
    table?.userId === 'userId'
      ? { where: mockOrderCountsWhere }
      : { where: mockSelectWhere }
  )
)
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/cache', () => ({
  cacheAdminUsersList: vi.fn((fetcher: () => Promise<unknown>) => fetcher()),
}))
vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: { users: { findMany: mockFindMany } },
    select: mockSelect,
  },
}))
vi.mock('@/lib/schema', () => ({
  users: { createdAt: 'createdAt', name: 'name', email: 'email' },
  orders: { userId: 'userId' },
}))
vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
  desc: vi.fn((col: string) => col),
  lt: vi.fn(),
  ilike: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  inArray: vi.fn(),
}))

import { GET } from '@/app/api/admin/users/route'

const makeAdminUser = (overrides = {}) => ({
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'USER',
  emailVerified: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  image: null,
  ...overrides,
})

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectWhere.mockResolvedValue([{ value: 0 }])
    mockOrderCountsWhere.mockReturnValue({ groupBy: mockOrderCountsGroupBy })
    mockOrderCountsGroupBy.mockResolvedValue([])
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users')
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 403 when user is not admin', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
    })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users')
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Not authorized - Admin access required')
  })

  it('returns user list for admin users', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    })

    const mockUsers = [
      makeAdminUser(),
      makeAdminUser({
        id: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'ADMIN',
      }),
    ]

    mockFindMany.mockResolvedValue(mockUsers)
    mockSelectWhere.mockResolvedValue([{ value: 2 }])
    mockOrderCountsGroupBy.mockResolvedValue([{ userId: 'u1', value: 2 }])

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.users).toHaveLength(2)
    expect(body.data.users[0].id).toBe('u1')
    expect(body.data.users[0]._count.orders).toBe(2)
    expect(body.data.users[1]._count.orders).toBe(0)
    expect(body.data.nextCursor).toBeNull()
    expect(body.data.hasMore).toBe(false)
    expect(body.data.totalCount).toBe(2)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ with: expect.anything() })
    )
    expect(mockOrderCountsWhere).toHaveBeenCalled()
  })

  it('returns hasMore=true and nextCursor when results exceed limit', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })

    const manyUsers = Array.from({ length: 21 }, (_, index) =>
      makeAdminUser({
        id: `u${index}`,
        email: `user${index}@test.com`,
      })
    )
    mockFindMany.mockResolvedValue(manyUsers)
    mockSelectWhere.mockResolvedValue([{ value: 21 }])

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users?limit=20')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.hasMore).toBe(true)
    expect(body.data.nextCursor).not.toBeNull()
    expect(body.data.users).toHaveLength(20)
    expect(body.data.totalCount).toBe(21)
  })

  it('passes cursor param to where clause builder', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockFindMany.mockResolvedValue([makeAdminUser()])

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/users?cursor=2024-01-01T00:00:00.000Z'
      )
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalled()
    expect(body.data.users).toHaveLength(1)
  })

  it('passes search param to where clause builder', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockFindMany.mockResolvedValue([makeAdminUser({ name: 'Alice' })])

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users?search=alice')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.users[0].name).toBe('Alice')
  })

  it('serializes Date createdAt/updatedAt to ISO strings', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockFindMany.mockResolvedValue([makeAdminUser()])

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users')
    )
    const body = await response.json()

    expect(typeof body.data.users[0].createdAt).toBe('string')
    expect(typeof body.data.users[0].updatedAt).toBe('string')
  })

  it('calls handleApiError on exception', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    })
    mockFindMany.mockRejectedValue(new Error('DB connection failed'))

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users')
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
  })

  it('rejects offsets beyond the cursor-pagination threshold', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users?offset=10001')
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Offset must not exceed 10000')
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})
