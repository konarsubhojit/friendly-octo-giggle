import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuth, mockTransaction, mockSet, mockWhere } = vi.hoisted(() => {
  const mockSet = vi.fn()
  const mockWhere = vi.fn()
  const mockUpdate = vi.fn(() => ({
    set: (...args: unknown[]) => {
      mockSet(...args)
      return { where: (...w: unknown[]) => mockWhere(...w) }
    },
  }))
  const mockTransaction = vi.fn(
    async (fn: (tx: { update: typeof mockUpdate }) => Promise<unknown>) => {
      return fn({ update: mockUpdate })
    }
  )
  return {
    mockAuth: vi.fn(),
    mockTransaction,
    mockSet,
    mockWhere,
  }
})

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { transaction: mockTransaction },
}))
vi.mock('@/lib/schema', () => ({
  categories: { id: 'id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { PATCH } from '@/app/api/admin/categories/reorder/route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/categories/reorder', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/categories/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await PATCH(
      makeRequest({ items: [{ id: 'c1', sortOrder: 0 }] })
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns 403 for non-admin users', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'USER' } })

    const response = await PATCH(
      makeRequest({ items: [{ id: 'c1', sortOrder: 0 }] })
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('Not authorized')
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns 400 when items array is empty', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'ADMIN' } })

    const response = await PATCH(makeRequest({ items: [] }))

    expect(response.status).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid items shape', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'ADMIN' } })

    const response = await PATCH(
      makeRequest({ items: [{ id: '', sortOrder: -1 }] })
    )

    expect(response.status).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('updates each category sortOrder in a single transaction', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'ADMIN' } })

    const response = await PATCH(
      makeRequest({
        items: [
          { id: 'c1', sortOrder: 0 },
          { id: 'c2', sortOrder: 1 },
        ],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ reordered: true })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledTimes(2)
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sortOrder: 0, updatedAt: expect.any(Date) })
    )
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sortOrder: 1, updatedAt: expect.any(Date) })
    )
    expect(mockWhere).toHaveBeenCalledTimes(2)
  })

  it('returns 500 when the transaction throws', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'ADMIN' } })
    mockTransaction.mockRejectedValueOnce(new Error('tx failed'))

    const response = await PATCH(
      makeRequest({ items: [{ id: 'c1', sortOrder: 0 }] })
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('tx failed')
  })
})
