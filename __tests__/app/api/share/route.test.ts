import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSharesCreate } = vi.hoisted(() => ({
  mockSharesCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    shares: {
      create: mockSharesCreate,
    },
  },
}))

vi.mock('@/lib/api-middleware', () => ({
  withLogging: vi.fn((handler) => handler),
}))

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { POST } from '@/app/api/share/route'

const makePostRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/share', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/share', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid productId', async () => {
    const response = await POST(makePostRequest({ productId: 'bad!' }))
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 for missing productId', async () => {
    const response = await POST(makePostRequest({}))
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 for invalid variantId', async () => {
    const response = await POST(
      makePostRequest({ productId: 'abc1234', variantId: 'too-long-id!' })
    )
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('creates a share for a product without variation', async () => {
    mockSharesCreate.mockResolvedValue('shr1234')

    const response = await POST(makePostRequest({ productId: 'abc1234' }))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.key).toBe('shr1234')
    expect(data.data.shareUrl).toContain('/s/shr1234')
    expect(mockSharesCreate).toHaveBeenCalledWith('abc1234', null)
  })

  it('creates a share for a product with a variant', async () => {
    mockSharesCreate.mockResolvedValue('shr5678')

    const response = await POST(
      makePostRequest({ productId: 'abc1234', variantId: 'var5678' })
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.key).toBe('shr5678')
    expect(data.data.shareUrl).toContain('/s/shr5678')
    expect(mockSharesCreate).toHaveBeenCalledWith('abc1234', 'var5678')
  })

  it('returns 500 when db.shares.create throws', async () => {
    mockSharesCreate.mockRejectedValue(new Error('DB error'))

    const response = await POST(makePostRequest({ productId: 'abc1234' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
  })

  it('handles null variantId explicitly', async () => {
    mockSharesCreate.mockResolvedValue('shr9999')

    const response = await POST(
      makePostRequest({ productId: 'abc1234', variantId: null })
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(mockSharesCreate).toHaveBeenCalledWith('abc1234', null)
  })
})
