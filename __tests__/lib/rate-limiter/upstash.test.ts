// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const { mockLimit, mockRatelimitCtor, mockSlidingWindow, mockRedisCtor } =
  vi.hoisted(() => ({
    mockLimit: vi.fn(),
    mockRatelimitCtor: vi.fn(),
    mockSlidingWindow: vi.fn((max: number, window: string) => ({
      max,
      window,
    })),
    mockRedisCtor: vi.fn(),
  }))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    class {
      constructor(...args: unknown[]) {
        mockRatelimitCtor(...args)
      }
      limit(...args: unknown[]) {
        return mockLimit(...args)
      }
    },
    { slidingWindow: mockSlidingWindow }
  ),
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(...args: unknown[]) {
      mockRedisCtor(...args)
    }
  },
}))

import { UpstashRateLimiter } from '@/lib/rate-limiter/upstash'

describe('UpstashRateLimiter', () => {
  it('configures the underlying Ratelimit client with a sliding window', () => {
    new UpstashRateLimiter({
      url: 'https://upstash.example.com',
      token: 'token',
      maxRequests: 10,
      windowSeconds: 60,
      prefix: 'rl:test',
    })

    expect(mockRedisCtor).toHaveBeenCalledWith({
      url: 'https://upstash.example.com',
      token: 'token',
    })
    expect(mockSlidingWindow).toHaveBeenCalledWith(10, '60 s')
    expect(mockRatelimitCtor).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: 'rl:test' })
    )
  })

  it('maps the underlying limit() result to a RateLimitResult', async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 12345,
    })

    const limiter = new UpstashRateLimiter({
      url: 'https://upstash.example.com',
      token: 'token',
      maxRequests: 10,
      windowSeconds: 60,
      prefix: 'rl:test',
    })

    const result = await limiter.limit('user-1')

    expect(mockLimit).toHaveBeenCalledWith('user-1')
    expect(result).toEqual({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 12345,
    })
  })
})
