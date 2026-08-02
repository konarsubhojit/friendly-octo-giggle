import { describe, it, expect, vi, beforeEach } from 'vitest'

const getRedisClientMock = vi.hoisted(() => vi.fn())
const logCacheOperationMock = vi.hoisted(() => vi.fn())
const logErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/redis', () => ({
  getRedisClient: getRedisClientMock,
}))

vi.mock('@/lib/logger', () => ({
  logCacheOperation: logCacheOperationMock,
  logError: logErrorMock,
}))

import {
  buildAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
} from '@/lib/ai/ai-cache'

describe('ai-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildAiCacheKey', () => {
    it('normalizes casing and whitespace', () => {
      expect(buildAiCacheKey('p1', '  Is  This   Mug   Big? ', 'USD')).toBe(
        'ai:response:p1:USD:is this mug big?'
      )
    })

    it('defaults the currency to INR', () => {
      expect(buildAiCacheKey('p1', 'size?')).toBe('ai:response:p1:INR:size?')
    })

    it('separates keys by product and currency', () => {
      expect(buildAiCacheKey('p1', 'q', 'INR')).not.toBe(
        buildAiCacheKey('p2', 'q', 'INR')
      )
      expect(buildAiCacheKey('p1', 'q', 'INR')).not.toBe(
        buildAiCacheKey('p1', 'q', 'USD')
      )
    })
  })

  describe('getCachedAiResponse', () => {
    it('returns null when Redis is unavailable', async () => {
      getRedisClientMock.mockReturnValue(null)
      await expect(getCachedAiResponse('p1', 'q')).resolves.toBeNull()
      expect(logCacheOperationMock).not.toHaveBeenCalled()
    })

    it('returns the cached value and logs a hit', async () => {
      const get = vi.fn().mockResolvedValue('cached answer')
      getRedisClientMock.mockReturnValue({ get })

      await expect(getCachedAiResponse('p1', 'q', 'USD')).resolves.toBe(
        'cached answer'
      )
      expect(get).toHaveBeenCalledWith('ai:response:p1:USD:q')
      expect(logCacheOperationMock).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'hit', success: true })
      )
    })

    it('logs a miss when the key is absent', async () => {
      getRedisClientMock.mockReturnValue({
        get: vi.fn().mockResolvedValue(null),
      })

      await expect(getCachedAiResponse('p1', 'q')).resolves.toBeNull()
      expect(logCacheOperationMock).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'miss', success: true })
      )
    })

    it('swallows Redis errors and returns null', async () => {
      getRedisClientMock.mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('redis down')),
      })

      await expect(getCachedAiResponse('p1', 'q')).resolves.toBeNull()
      expect(logErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'ai_cache_get' })
      )
    })
  })

  describe('setCachedAiResponse', () => {
    it('does nothing when Redis is unavailable', async () => {
      getRedisClientMock.mockReturnValue(null)
      await setCachedAiResponse('p1', 'q', 'INR', 'answer')
      expect(logCacheOperationMock).not.toHaveBeenCalled()
    })

    it('writes with a one hour TTL', async () => {
      const setex = vi.fn().mockResolvedValue('OK')
      getRedisClientMock.mockReturnValue({ setex })

      await setCachedAiResponse('p1', 'q', 'INR', 'answer')

      expect(setex).toHaveBeenCalledWith('ai:response:p1:INR:q', 3600, 'answer')
      expect(logCacheOperationMock).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'set', ttl: 3600, success: true })
      )
    })

    it('swallows Redis errors', async () => {
      getRedisClientMock.mockReturnValue({
        setex: vi.fn().mockRejectedValue(new Error('redis down')),
      })

      await expect(
        setCachedAiResponse('p1', 'q', 'INR', 'answer')
      ).resolves.toBeUndefined()
      expect(logErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'ai_cache_set' })
      )
    })
  })
})
