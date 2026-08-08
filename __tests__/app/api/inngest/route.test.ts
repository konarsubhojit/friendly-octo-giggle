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
import { inngestFunctions } from '@/lib/inngest/registry'

describe('GET/POST/PUT /api/inngest', () => {
  it('serves every registered function from the shared client', () => {
    expect(mockServe).toHaveBeenCalledWith({
      client: inngest,
      functions: [...inngestFunctions],
    })
    expect(route.GET).toBeDefined()
    expect(route.POST).toBeDefined()
    expect(route.PUT).toBeDefined()
  })

  it('bounds a step invocation to the claim-holder budget', () => {
    // Longer than STALE_PROCESSING_CLAIM_MS would let a live claim be stolen.
    expect(route.maxDuration).toBe(30)
    // Under Cache Components route handlers are dynamic unless they opt into
    // `"use cache"`, so the legacy `dynamic = 'force-dynamic'` export is gone.
    expect((route as { dynamic?: string }).dynamic).toBeUndefined()
  })
})
