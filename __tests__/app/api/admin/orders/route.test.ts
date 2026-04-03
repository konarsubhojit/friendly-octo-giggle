import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}))
const mockSelectWhere = vi.hoisted(() => vi.fn())
const mockSelectFrom = vi.hoisted(() =>
  vi.fn(() => ({ where: mockSelectWhere }))
)
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      orders: { findMany: mockFindMany },
    },
    select: mockSelect,
  },
}))
vi.mock('@/lib/schema', () => ({
  orders: {
    createdAt: 'createdAt',
    status: 'status',
    customerName: 'customerName',
    customerEmail: 'customerEmail',
    id: 'id',
  },
}))
vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
  desc: vi.fn((col) => col),
  lt: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  SQL: vi.fn(),
}))
vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock('@/lib/cache', () => ({
  cacheAdminOrdersList: vi.fn((fetcher: () => Promise<unknown>) => fetcher()),
}))
vi.mock('@/lib/serializers', () => ({ serializeOrders: vi.fn((o) => o) }))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))
vi.mock('@/features/orders/services/order-search', () => ({
  searchOrderIds: vi.fn(),
}))

import { GET } from '@/app/api/admin/orders/route'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { searchOrderIds } from '@/features/orders/services/order-search'

const mockCheckAdminAuth = vi.mocked(checkAdminAuth)
const mockSearchOrderIds = vi.mocked(searchOrderIds)

const makeRequest = (params?: Record<string, string>) => {
  const url = new URL('http://localhost/api/admin/orders')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url)
}

describe('GET /api/admin/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectWhere.mockResolvedValue([{ value: 0 }])
    mockSearchOrderIds.mockResolvedValue(null)
  })

  it('returns 401 when not authenticated', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })
    const response = await GET(makeRequest())
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toBe('Not authenticated')
  })

  it('returns 403 when user is not admin', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    })
    const response = await GET(makeRequest())
    const data = await response.json()
    expect(response.status).toBe(403)
    expect(data.error).toBe('Not authorized - Admin access required')
  })

  it('returns orders on success', async () => {
    const mockOrders = [
      {
        id: 'order1',
        userId: 'user1',
        status: 'PENDING',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        items: [],
      },
    ]

    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-user',
    })
    mockFindMany.mockResolvedValue(mockOrders)
    mockSelectWhere.mockResolvedValue([{ value: 1 }])

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.orders).toHaveLength(1)
    expect(data.data.orders[0].id).toBe('order1')
    expect(data.data).toHaveProperty('hasMore')
    expect(data.data).toHaveProperty('nextCursor')
    expect(data.data.totalCount).toBe(1)
  })

  it('returns 500 on database error', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-user',
    })
    mockFindMany.mockRejectedValue(new Error('Database error'))

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('uses shared order search ids when search is provided', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-user',
    })
    mockSearchOrderIds.mockResolvedValue(['order1', 'order2'])
    mockFindMany.mockResolvedValue([])

    const response = await GET(makeRequest({ search: 'rose' }))

    expect(response.status).toBe(200)
    expect(mockSearchOrderIds).toHaveBeenCalledWith('rose', {
      status: undefined,
      limit: 1000,
    })
  })
})
