import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockApiError = vi.hoisted(() => vi.fn())
const mockApiSuccess = vi.hoisted(() => vi.fn())
const mockHandleApiError = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockResetIndex = vi.hoisted(() => vi.fn())
const mockIndexProducts = vi.hoisted(() => vi.fn())
const mockGetIndexInfo = vi.hoisted(() => vi.fn())
const mockIsSearchAvailable = vi.hoisted(() => vi.fn())
const mockOrdersSearchAvailable = vi.hoisted(() => vi.fn())
const mockCreateOrRefreshOrdersSearchIndex = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/api-utils', () => ({
  apiError: mockApiError,
  apiSuccess: mockApiSuccess,
  handleApiError: mockHandleApiError,
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: {
        findMany: mockFindMany,
      },
    },
  },
}))

vi.mock('@/lib/schema', () => ({
  products: {
    deletedAt: 'deletedAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  isNull: vi.fn(() => 'is-null'),
}))

vi.mock('@/lib/search', () => ({
  getIndexInfo: mockGetIndexInfo,
  indexProducts: mockIndexProducts,
  isSearchAvailable: mockIsSearchAvailable,
  resetIndex: mockResetIndex,
}))

vi.mock('@/features/orders/services/orders-search-index', () => ({
  areOrdersSearchControlsAvailable: mockOrdersSearchAvailable,
  createOrRefreshOrdersSearchIndex: mockCreateOrRefreshOrdersSearchIndex,
}))

import { POST } from '@/app/api/admin/search/reindex/route'

describe('POST /api/admin/search/reindex', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { role: 'ADMIN' } })
    mockApiError.mockImplementation((error, status, details) => ({
      success: false,
      error,
      status,
      details,
    }))
    mockApiSuccess.mockImplementation((data, status = 200) => ({
      success: true,
      status,
      data,
    }))
    mockHandleApiError.mockImplementation((error) => ({ error }))
    mockIsSearchAvailable.mockReturnValue(true)
    mockOrdersSearchAvailable.mockReturnValue(true)
    mockFindMany.mockResolvedValue([])
    mockCreateOrRefreshOrdersSearchIndex.mockResolvedValue({
      indexedOrders: 4,
      indexCreated: true,
    })
  })

  it('reindexes orders through the shared Redis index helper', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/search/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'orders' }),
      })
    )

    expect(mockCreateOrRefreshOrdersSearchIndex).toHaveBeenCalledOnce()
    expect(mockResetIndex).not.toHaveBeenCalled()
    expect(response).toEqual({
      success: true,
      status: 200,
      data: {
        reindexed: { orders: 4 },
        details: { ordersIndexCreated: true },
      },
    })
  })

  it('returns 503 when orders search infrastructure is missing', async () => {
    mockOrdersSearchAvailable.mockReturnValue(false)

    const response = await POST(
      new Request('http://localhost/api/admin/search/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'orders' }),
      })
    )

    expect(mockCreateOrRefreshOrdersSearchIndex).not.toHaveBeenCalled()
    expect(response).toEqual({
      success: false,
      error: 'Redis Search is not configured',
      status: 503,
      details: undefined,
    })
  })

  it('keeps product reindex behavior intact', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'prod-1',
        name: 'Rose Bouquet',
        description: 'Fresh roses',
        category: 'Flowers',
        image: '/rose.png',
      },
    ])

    const response = await POST(
      new Request('http://localhost/api/admin/search/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'products' }),
      })
    )

    expect(mockResetIndex).toHaveBeenCalledWith('products')
    expect(mockIndexProducts).toHaveBeenCalledWith(
      [
        {
          id: 'prod-1',
          name: 'Rose Bouquet',
          description: 'Fresh roses',
          category: 'Flowers',
          image: '/rose.png',
        },
      ],
      { throwOnError: true }
    )
    expect(response).toEqual({
      success: true,
      status: 200,
      data: { reindexed: { products: 1 } },
    })
  })
})
