import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCheckAdminAuth, mockGetAdminSalesDashboardData } = vi.hoisted(
  () => ({
    mockCheckAdminAuth: vi.fn(),
    mockGetAdminSalesDashboardData: vi.fn(),
  })
)

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/features/admin/services/admin-sales', () => ({
  getAdminSalesDashboardData: mockGetAdminSalesDashboardData,
}))

describe('GET /api/admin/sales/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unauthorized when user is not admin', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })

    const { GET } = await import('@/app/api/admin/sales/export/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns csv export with sales rows', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
    })
    mockGetAdminSalesDashboardData.mockResolvedValue({
      recentSales: [
        { date: '2026-05-01', orders: 2, revenue: 100, label: 'Thu' },
        { date: '2026-05-02', orders: 4, revenue: 300, label: 'Fri' },
      ],
    })

    const { GET } = await import('@/app/api/admin/sales/export/route')
    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('.csv')
    expect(body).toContain('Date,Orders,Revenue,Average Order Value')
    expect(body).toContain('2026-05-01,2,100,50')
    expect(body).toContain('2026-05-02,4,300,75')
  })
})
