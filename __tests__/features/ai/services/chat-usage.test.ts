import { beforeEach, describe, expect, it, vi } from 'vitest'

const redisState = vi.hoisted(() => new Map<string, Record<string, number>>())

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({
    async hgetall(key: string) {
      return redisState.get(key) ?? {}
    },
    async hincrby(key: string, field: string, delta: number) {
      const existing = redisState.get(key) ?? {}
      existing[field] = Number(existing[field] ?? 0) + delta
      redisState.set(key, existing)
      return existing[field]
    },
    async expire() {
      return 1
    },
  })),
}))

import {
  enforceQuotas,
  getDailyUsage,
  recordAdvancedUsage,
  recordDailyUsage,
} from '@/features/ai/services/chat-usage'

describe('chat-usage', () => {
  beforeEach(() => {
    redisState.clear()
  })

  it('shares request and token quotas across product and catalog surfaces for one identity', async () => {
    await recordDailyUsage('user-1', 100)
    await recordDailyUsage('user-1', 200)
    await recordAdvancedUsage('user-1')

    const usageBeforeProductTurn = await getDailyUsage('user-1')
    expect(usageBeforeProductTurn).toEqual({ requests: 2, tokens: 300 })

    const quotaError = await enforceQuotas({
      userId: 'user-1',
      dailyUsage: usageBeforeProductTurn,
      reservedTotalTokens: 50,
      requestQuota: 2,
      tokenQuota: 1000,
      usesAdvancedFeatures: false,
      advancedQuota: 10,
    })

    expect(quotaError).toBe('Daily AI chat request quota exceeded')
  })

  it('shares advanced-intent quota regardless of which surface used it first', async () => {
    await recordAdvancedUsage('user-1')

    const quotaError = await enforceQuotas({
      userId: 'user-1',
      dailyUsage: { requests: 0, tokens: 0 },
      reservedTotalTokens: 50,
      requestQuota: 10,
      tokenQuota: 1000,
      usesAdvancedFeatures: true,
      advancedQuota: 1,
    })

    expect(quotaError).toBe('Daily advanced AI request quota exceeded')
  })
})
