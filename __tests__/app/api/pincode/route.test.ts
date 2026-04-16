import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetPincodeSummary = vi.hoisted(() => vi.fn())

vi.mock('@/server/pincode-loader', () => ({
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

  it('returns 400 for a pincode with letters', async () => {
    const response = await GET(createRequest('ABCDEF'), {
      params: Promise.resolve({ code: 'ABCDEF' }),
    })

    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns 400 for an empty string pincode', async () => {
    const response = await GET(createRequest(''), {
      params: Promise.resolve({ code: '' }),
    })

    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns 400 for a pincode with more than 6 digits', async () => {
    const response = await GET(createRequest('1234567'), {
      params: Promise.resolve({ code: '1234567' }),
    })

    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns 400 for a pincode with special characters', async () => {
    const response = await GET(createRequest('56-001'), {
      params: Promise.resolve({ code: '56-001' }),
    })

    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns city and state correctly mapped from district field', async () => {
    mockGetPincodeSummary.mockReturnValue({
      success: true,
      data: { district: 'Mumbai', state: 'Maharashtra' },
    })

    const response = await GET(createRequest('400001'), {
      params: Promise.resolve({ code: '400001' }),
    })

    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.city).toBe('Mumbai')
    expect(json.data.state).toBe('Maharashtra')
  })

  it('returns stale-while-revalidate in Cache-Control header on success', async () => {
    mockGetPincodeSummary.mockReturnValue({
      success: true,
      data: { district: 'Chennai', state: 'Tamil Nadu' },
    })

    const response = await GET(createRequest('600001'), {
      params: Promise.resolve({ code: '600001' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain(
      'stale-while-revalidate=86400'
    )
  })

  it('does not set Cache-Control header on 404', async () => {
    mockGetPincodeSummary.mockReturnValue({
      success: false,
      data: null,
    })

    const response = await GET(createRequest('000000'), {
      params: Promise.resolve({ code: '000000' }),
    })

    expect(response.status).toBe(404)
    // 404 responses must not carry a long-lived cache directive
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeNull()
  })
})
