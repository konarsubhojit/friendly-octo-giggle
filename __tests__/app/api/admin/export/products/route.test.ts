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
      products: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
  },
}))
vi.mock('@/lib/schema', () => ({
  products: { id: 'id', createdAt: 'createdAt', deletedAt: 'deletedAt' },
}))
vi.mock('drizzle-orm', () => ({
  asc: vi.fn((x: unknown) => x),
  isNull: vi.fn((x: unknown) => x),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { GET } from '@/app/api/admin/export/products/route'

const product = {
  id: 'p1',
  name: 'Cotton Shirt',
  description: 'Soft and breezy',
  category: 'Clothing',
  image: 'https://example.com/p1.jpg',
  images: ['https://example.com/p1.jpg'],
  createdAt: new Date('2025-01-02T03:04:05.000Z'),
  variants: [
    { price: 1500, stock: 5 },
    { price: 1200, stock: 2 },
  ],
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

describe('GET /api/admin/export/products', () => {
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

  it('streams CSV with header + computed min price and total stock', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany.mockResolvedValueOnce([product]).mockResolvedValueOnce([])

    const response = await GET()
    const csv = await readStream(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain(
      'products.csv'
    )

    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe(
      'id,name,description,category,image,images,minPrice,stock,createdAt'
    )
    // minPrice = min(1500, 1200) = 1200; stock = 5 + 2 = 7
    expect(lines[1]).toContain('p1,Cotton Shirt,Soft and breezy,Clothing,')
    expect(lines[1]).toContain(',1200,7,2025-01-02T03:04:05.000Z')
  })

  it('emits 0/0 for min price and stock when product has no variants', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany
      .mockResolvedValueOnce([{ ...product, variants: [] }])
      .mockResolvedValueOnce([])

    const response = await GET()
    const csv = await readStream(response)

    const dataLine = csv.trim().split('\n')[1]
    expect(dataLine).toContain(',0,0,2025-01-02T03:04:05.000Z')
  })

  it('streams only the header row when there are no products', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockFindMany.mockResolvedValue([])

    const response = await GET()
    const csv = await readStream(response)

    expect(csv.trim().split('\n')).toHaveLength(1)
  })
})
