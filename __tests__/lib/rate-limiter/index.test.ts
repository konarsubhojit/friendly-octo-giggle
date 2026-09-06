import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetProvider, mockGetStandardRedisCacheClient, mockEnv } =
  vi.hoisted(() => ({
    mockGetProvider: vi.fn(),
    mockGetStandardRedisCacheClient: vi.fn(() => ({ client: 'redis' })),
    mockEnv: {
      UPSTASH_REDIS_REST_URL: undefined as string | undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined as string | undefined,
      REDIS_URL: undefined as string | undefined,
    },
  }))

vi.mock('@/lib/providers/resolution', () => ({
  getProvider: mockGetProvider,
}))

vi.mock('@/lib/cache/index', () => ({
  getStandardRedisCacheClient: mockGetStandardRedisCacheClient,
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))

import { createRateLimiter } from '@/lib/rate-limiter'
import { InMemoryRateLimiter } from '@/lib/rate-limiter/memory'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.UPSTASH_REDIS_REST_URL = undefined
    mockEnv.UPSTASH_REDIS_REST_TOKEN = undefined
    mockEnv.REDIS_URL = undefined
  })

  it('returns an InMemoryRateLimiter for the memory provider', () => {
    mockGetProvider.mockReturnValue('memory')

    const limiter = createRateLimiter({ maxRequests: 5, prefix: 'rl' })

    expect(limiter).toBeInstanceOf(InMemoryRateLimiter)
  })

  it('defaults to an InMemoryRateLimiter for an unknown provider', () => {
    mockGetProvider.mockReturnValue('something-else')

    const limiter = createRateLimiter({
      maxRequests: 5,
      windowSeconds: 30,
      prefix: 'rl',
    })

    expect(limiter).toBeInstanceOf(InMemoryRateLimiter)
  })

  it('returns null for the upstash provider when credentials are missing', () => {
    mockGetProvider.mockReturnValue('upstash')

    const limiter = createRateLimiter({ maxRequests: 5, prefix: 'rl' })

    expect(limiter).toBeNull()
  })

  it('returns null for the redis provider when REDIS_URL is missing', () => {
    mockGetProvider.mockReturnValue('redis')

    const limiter = createRateLimiter({ maxRequests: 5, prefix: 'rl' })

    expect(limiter).toBeNull()
    expect(mockGetStandardRedisCacheClient).not.toHaveBeenCalled()
  })
})
