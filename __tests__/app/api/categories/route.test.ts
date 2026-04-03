import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDrizzleDb } = vi.hoisted(() => ({
  mockDrizzleDb: {
    select: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ drizzleDb: mockDrizzleDb }))
vi.mock('@/lib/schema', () => ({
  categories: {
    id: 'id',
    name: 'name',
    sortOrder: 'sortOrder',
    deletedAt: 'deletedAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  isNull: vi.fn(),
  asc: vi.fn(),
}))

import { GET } from '@/app/api/categories/route'

describe('categories API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns categories list', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: '1', name: 'Clothing' },
          { id: '2', name: 'Electronics' },
        ]),
      }
      mockDrizzleDb.select.mockReturnValue(selectChain)

      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data).toHaveLength(2)
      expect(body.data[0].name).toBe('Clothing')
    })

    it('includes cache headers', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      }
      mockDrizzleDb.select.mockReturnValue(selectChain)

      const response = await GET()

      expect(response.headers.get('Cache-Control')).toContain('s-maxage=60')
    })

    it('returns 500 on database error', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(new Error('DB error')),
      }
      mockDrizzleDb.select.mockReturnValue(selectChain)

      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBe('Failed to fetch categories')
    })
  })
})
