import { describe, it, expect, vi } from 'vitest'

const { mockServe } = vi.hoisted(() => ({
  mockServe: vi.fn(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
  })),
}))

vi.mock('inngest/next', () => ({
  serve: mockServe,
}))

import * as route from '@/app/api/inngest/route'
import { inngest } from '@/lib/inngest/client'
import { processCheckoutRequestFunction } from '@/features/cart/inngest/checkout'

describe('GET/POST/PUT /api/inngest', () => {
  it('serves the checkout function from the shared client', () => {
    expect(mockServe).toHaveBeenCalledWith({
      client: inngest,
      functions: [processCheckoutRequestFunction],
    })
    expect(route.GET).toBeDefined()
    expect(route.POST).toBeDefined()
    expect(route.PUT).toBeDefined()
  })

  it('bounds a step invocation to the claim-holder budget', () => {
    // Longer than STALE_PROCESSING_CLAIM_MS would let a live claim be stolen.
    expect(route.maxDuration).toBe(30)
    expect(route.dynamic).toBe('force-dynamic')
  })
})
