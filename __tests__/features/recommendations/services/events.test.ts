import { beforeEach, describe, expect, it, vi } from 'vitest'

const { logBusinessEvent } = vi.hoisted(() => ({
  logBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logBusinessEvent }))

import { recordRecommendationEvent } from '@/features/recommendations/services/events'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recordRecommendationEvent', () => {
  it('emits an impression under its own event name', () => {
    recordRecommendationEvent({
      type: 'impression',
      surface: 'product',
      anchorProductId: 'aaaaaaa',
      productIds: ['bbbbbbb', 'ccccccc'],
      fallback: false,
    })

    expect(logBusinessEvent).toHaveBeenCalledWith({
      event: 'recommendation_impression',
      details: {
        surface: 'product',
        anchorProductId: 'aaaaaaa',
        productIds: ['bbbbbbb', 'ccccccc'],
        fallback: false,
      },
      success: true,
    })
  })

  it('emits a click under a distinct event name, so the two can be divided for a CTR', () => {
    recordRecommendationEvent({
      type: 'click',
      surface: 'cart',
      anchorProductId: null,
      productIds: ['bbbbbbb'],
      fallback: true,
    })

    expect(logBusinessEvent).toHaveBeenCalledWith({
      event: 'recommendation_click',
      details: {
        surface: 'cart',
        anchorProductId: null,
        productIds: ['bbbbbbb'],
        fallback: true,
      },
      success: true,
    })
  })

  it('records which surface produced the event', () => {
    recordRecommendationEvent({
      type: 'impression',
      surface: 'zero_result',
      anchorProductId: null,
      productIds: ['bbbbbbb'],
      fallback: false,
    })

    expect(logBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ surface: 'zero_result' }),
      })
    )
  })

  it('records whether the rail was served from the fallback', () => {
    recordRecommendationEvent({
      type: 'impression',
      surface: 'home',
      anchorProductId: null,
      productIds: ['bbbbbbb'],
      fallback: true,
    })

    expect(logBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ fallback: true }),
      })
    )
  })

  it('does not persist anything beyond the log record', () => {
    recordRecommendationEvent({
      type: 'click',
      surface: 'home',
      anchorProductId: null,
      productIds: ['bbbbbbb'],
      fallback: false,
    })

    expect(logBusinessEvent).toHaveBeenCalledTimes(1)
  })
})
