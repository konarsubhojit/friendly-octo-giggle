import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLogBusinessEvent } = vi.hoisted(() => ({
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: vi.fn(),
}))

import { POST } from '@/app/api/search/click/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/search/click', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/search/click', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs a search_result_click and returns success for a valid body', async () => {
    const response = await POST(
      makeRequest({ productId: 'p1', query: 'cotton shirt' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ ok: true })
    expect(mockLogBusinessEvent).toHaveBeenCalledWith({
      event: 'search_result_click',
      details: { productId: 'p1', query: 'cotton shirt' },
      success: true,
    })
  })

  it('accepts an omitted query and logs query as null', async () => {
    const response = await POST(makeRequest({ productId: 'p1' }))

    expect(response.status).toBe(200)
    expect(mockLogBusinessEvent).toHaveBeenCalledWith({
      event: 'search_result_click',
      details: { productId: 'p1', query: null },
      success: true,
    })
  })

  it('returns 400 when productId is missing', async () => {
    const response = await POST(makeRequest({ query: 'x' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockLogBusinessEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when productId is empty', async () => {
    const response = await POST(makeRequest({ productId: '' }))

    expect(response.status).toBe(400)
    expect(mockLogBusinessEvent).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const request = new NextRequest('http://localhost/api/search/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockLogBusinessEvent).not.toHaveBeenCalled()
  })
})
