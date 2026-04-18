import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSharesResolve } = vi.hoisted(() => ({
  mockSharesResolve: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    shares: {
      resolve: mockSharesResolve,
    },
  },
}))

import { GET } from '@/app/s/[key]/route'

const makeGetRequest = (key: string) =>
  new NextRequest(`http://localhost/s/${key}`)

describe('GET /s/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to home when share key is not found', async () => {
    mockSharesResolve.mockResolvedValue(null)

    const response = await GET(makeGetRequest('notfound'), {
      params: Promise.resolve({ key: 'notfound' }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redirects to product page without variant when variantId is null', async () => {
    mockSharesResolve.mockResolvedValue({
      productId: 'prd1234',
      variantId: null,
    })

    const response = await GET(makeGetRequest('abc1234'), {
      params: Promise.resolve({ key: 'abc1234' }),
    })

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toBe('http://localhost/products/prd1234')
  })

  it('redirects to product page with variant query param', async () => {
    mockSharesResolve.mockResolvedValue({
      productId: 'prd1234',
      variantId: 'var5678',
    })

    const response = await GET(makeGetRequest('abc1234'), {
      params: Promise.resolve({ key: 'abc1234' }),
    })

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toBe('http://localhost/products/prd1234?v=var5678')
  })

  it('resolves the key from the route params', async () => {
    mockSharesResolve.mockResolvedValue({
      productId: 'prd1234',
      variantId: null,
    })

    await GET(makeGetRequest('mykey12'), {
      params: Promise.resolve({ key: 'mykey12' }),
    })

    expect(mockSharesResolve).toHaveBeenCalledWith('mykey12')
  })
})
