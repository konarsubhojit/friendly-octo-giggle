import { describe, it, expect } from 'vitest'
import {
  InMemoryRateLimiter,
} from '@/lib/rate-limiter'

describe('InMemoryRateLimiter', () => {
  it('allows requests within the limit', async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000)
    const r1 = await limiter.limit('user:1')
    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = await limiter.limit('user:1')
    expect(r2.success).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = await limiter.limit('user:1')
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('rejects requests beyond the limit', async () => {
    const limiter = new InMemoryRateLimiter(2, 60_000)
    await limiter.limit('user:2')
    await limiter.limit('user:2')
    const r3 = await limiter.limit('user:2')
    expect(r3.success).toBe(false)
    expect(r3.remaining).toBe(0)
  })

  it('resets after the window expires', async () => {
    const limiter = new InMemoryRateLimiter(1, 1) // 1 ms window
    await limiter.limit('user:3')
    // wait for window to expire
    await new Promise((r) => setTimeout(r, 10))
    const r2 = await limiter.limit('user:3')
    expect(r2.success).toBe(true)
    expect(r2.remaining).toBe(0)
  })

  it('isolates identifiers', async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000)
    const r1 = await limiter.limit('user:a')
    const r2 = await limiter.limit('user:b')
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
  })
})
