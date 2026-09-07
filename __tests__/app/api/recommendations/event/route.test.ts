import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRecordRecommendationEvent } = vi.hoisted(() => ({
  mockRecordRecommendationEvent: vi.fn(),
}))

vi.mock('@/features/recommendations/services/events', () => ({
  recordRecommendationEvent: mockRecordRecommendationEvent,
}))

import { POST } from '@/app/api/recommendations/event/route'

const postRequest = (body: unknown) =>
  new NextRequest('https://localhost/api/recommendations/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/recommendations/event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records a valid impression event', async () => {
    const event = {
      type: 'impression',
      surface: 'product',
      anchorProductId: 'prod001',
      productIds: ['prod002', 'prod003'],
      fallback: false,
    }

    const response = await POST(postRequest(event))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.ok).toBe(true)
    expect(mockRecordRecommendationEvent).toHaveBeenCalledWith(event)
  })

  it('rejects a click event naming more than one product', async () => {
    const response = await POST(
      postRequest({
        type: 'click',
        surface: 'cart',
        anchorProductId: null,
        productIds: ['prod002', 'prod003'],
        fallback: false,
      })
    )

    expect(response.status).toBe(400)
    expect(mockRecordRecommendationEvent).not.toHaveBeenCalled()
  })

  it('rejects an invalid surface', async () => {
    const response = await POST(
      postRequest({
        type: 'impression',
        surface: 'not-a-surface',
        productIds: ['prod002'],
      })
    )

    expect(response.status).toBe(400)
    expect(mockRecordRecommendationEvent).not.toHaveBeenCalled()
  })
})
