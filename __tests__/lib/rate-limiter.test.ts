import { describe, it, expect, vi } from 'vitest'
import {
  InMemoryRateLimiter,
} from '@/lib/rate-limiter'
import { NodeRedisRateLimiter } from '@/lib/rate-limiter/node-redis'
import type { CacheClient } from '@/lib/cache/index'

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

describe('NodeRedisRateLimiter', () => {
  const mockEval = vi.fn()
  const mockClient = { eval: mockEval } as unknown as CacheClient

  it('allows requests when under the limit', async () => {
    mockEval.mockResolvedValueOnce([1, 60]) // current=1, ttl=60
    const limiter = new NodeRedisRateLimiter(mockClient, 5, 60, 'rl:test')

    const result = await limiter.limit('ip:1.2.3.4')

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.limit).toBe(5)
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      ['rl:test:ip:1.2.3.4'],
      ['5', '60']
    )
  })

  it('rejects requests when over the limit', async () => {
    mockEval.mockResolvedValueOnce([6, 45]) // current=6 > limit=5
    const limiter = new NodeRedisRateLimiter(mockClient, 5, 60, 'rl:test')

    const result = await limiter.limit('ip:1.2.3.4')

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('computes reset timestamp from TTL', async () => {
    const now = Date.now()
    mockEval.mockResolvedValueOnce([1, 30])
    const limiter = new NodeRedisRateLimiter(mockClient, 10, 60, 'rl:test')

    const result = await limiter.limit('user:x')

    // reset should be ~30 seconds from now
    expect(result.reset).toBeGreaterThanOrEqual(now + 29_000)
    expect(result.reset).toBeLessThanOrEqual(now + 31_000)
  })
})
