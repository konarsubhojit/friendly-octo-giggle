import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSuggestSearchTerms, mockGetCachedData } = vi.hoisted(() => ({
  mockSuggestSearchTerms: vi.fn(),
  mockGetCachedData: vi.fn(),
}))

vi.mock('@/lib/search-discovery', () => ({
  suggestSearchTerms: mockSuggestSearchTerms,
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: mockGetCachedData,
}))

import { GET } from '@/app/api/search/suggest/route'

describe('search suggest API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCachedData.mockImplementation(async (_key, _ttl, fetcher) => fetcher())
    mockSuggestSearchTerms.mockResolvedValue({
      query: 'rose',
      products: [{ id: 'p1', label: 'Rose Bouquet', category: 'Flowers' }],
      categories: ['Flowers'],
      popular: ['flower bouquet'],
    })
  })

  it('returns 400 for missing query', async () => {
    const request = new NextRequest('http://localhost/api/search/suggest')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('returns suggestions using cached fetcher', async () => {
    const request = new NextRequest(
      'http://localhost/api/search/suggest?q=rose&limit=5'
    )

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetCachedData).toHaveBeenCalled()
    expect(mockSuggestSearchTerms).toHaveBeenCalledWith('rose', 5)
    expect(body.data.products).toHaveLength(1)
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=30')
  })
})
