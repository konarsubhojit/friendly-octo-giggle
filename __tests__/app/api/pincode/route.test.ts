import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetPincodeSummary = vi.hoisted(() => vi.fn())

vi.mock('india-pincode', () => ({
  isValidPincode: (code: string) => /^\d{6}$/.test(code),
  getIndiaPincode: () => ({
    getPincodeSummary: mockGetPincodeSummary,
  }),
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  ),
}))

vi.mock('@/lib/cache', () => ({
  CACHE_KEYS: {
    PINCODE_LOOKUP: (code: string) => `pincode:${code}`,
  },
  CACHE_TTL: {
    PINCODE_LOOKUP: 31536000,
  },
}))

// Import after mocks so module-level getIndiaPincode() uses the mock
import { GET } from '@/app/api/pincode/[code]/route'

const createRequest = (code: string) =>
  new NextRequest(`http://localhost/api/pincode/${code}`)

describe('GET /api/pincode/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns city and state for a valid pincode', async () => {
    mockGetPincodeSummary.mockReturnValue({
      success: true,
      data: { district: 'Bengaluru', state: 'Karnataka' },
    })

    const response = await GET(createRequest('560001'), {
      params: Promise.resolve({ code: '560001' }),
    })

    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ city: 'Bengaluru', state: 'Karnataka' })
  })

  it('returns 400 for invalid pincode format', async () => {
    const response = await GET(createRequest('1234'), {
      params: Promise.resolve({ code: '1234' }),
    })

    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns 404 when pincode is not found', async () => {
    mockGetPincodeSummary.mockReturnValue({
      success: false,
      data: null,
    })

    const response = await GET(createRequest('999999'), {
      params: Promise.resolve({ code: '999999' }),
    })

    const json = await response.json()
    expect(response.status).toBe(404)
    expect(json.success).toBe(false)
  })

  it('includes long-lived Cache-Control header on success', async () => {
    mockGetPincodeSummary.mockReturnValue({
      success: true,
      data: { district: 'Delhi', state: 'Delhi' },
    })

    const response = await GET(createRequest('110001'), {
      params: Promise.resolve({ code: '110001' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=31536000')
  })
})
