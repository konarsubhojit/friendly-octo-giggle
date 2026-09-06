import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRedisInstance, mockRedisCtor } = vi.hoisted(() => {
  const mockPipelineInner = {
    del: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    hgetall: vi.fn().mockReturnThis(),
    setex: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(['ok']),
  }
  const mockRedisInstance = {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    hset: vi.fn(),
    hgetall: vi.fn(),
    hincrby: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    srem: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
    scan: vi.fn(),
    eval: vi.fn(),
    pipeline: vi.fn(() => mockPipelineInner),
    __pipelineInner: mockPipelineInner,
  }
  const mockRedisCtor = vi.fn()
  return { mockRedisInstance, mockRedisCtor }
})

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(...args: unknown[]) {
      mockRedisCtor(...args)
      return mockRedisInstance
    }
  },
}))

import { UpstashCacheClient } from '@/lib/cache/upstash-adapter'

describe('UpstashCacheClient', () => {
  let client: UpstashCacheClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new UpstashCacheClient('https://upstash.example.com', 'token')
  })

  it('constructs the underlying Redis client and reports ready', () => {
    expect(mockRedisCtor).toHaveBeenCalledWith({
      url: 'https://upstash.example.com',
      token: 'token',
    })
    expect(client.isReady).toBe(true)
  })

  it('get delegates to redis.get', async () => {
    mockRedisInstance.get.mockResolvedValue('value')
    expect(await client.get('k')).toBe('value')
    expect(mockRedisInstance.get).toHaveBeenCalledWith('k')
  })

  it('set with ex+nx passes both options', async () => {
    mockRedisInstance.set.mockResolvedValue('OK')
    await client.set('k', 'v', { ex: 60, nx: true })
    expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v', {
      ex: 60,
      nx: true,
    })
  })

  it('set with only ex passes ex option', async () => {
    mockRedisInstance.set.mockResolvedValue('OK')
    await client.set('k', 'v', { ex: 60 })
    expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v', { ex: 60 })
  })

  it('set with only nx passes nx option', async () => {
    mockRedisInstance.set.mockResolvedValue('OK')
    await client.set('k', 'v', { nx: true })
    expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v', { nx: true })
  })

  it('set with no options calls redis.set without options', async () => {
    mockRedisInstance.set.mockResolvedValue('OK')
    await client.set('k', 'v')
    expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v')
  })

  it('setex delegates to redis.setex', async () => {
    mockRedisInstance.setex.mockResolvedValue('OK')
    expect(await client.setex('k', 30, 'v')).toBe('OK')
    expect(mockRedisInstance.setex).toHaveBeenCalledWith('k', 30, 'v')
  })

  it('hset delegates to redis.hset', async () => {
    mockRedisInstance.hset.mockResolvedValue(2)
    expect(await client.hset('k', { a: '1' })).toBe(2)
  })

  it('hgetall delegates to redis.hgetall', async () => {
    mockRedisInstance.hgetall.mockResolvedValue({ a: '1' })
    expect(await client.hgetall('k')).toEqual({ a: '1' })
  })

  it('hincrby delegates to redis.hincrby', async () => {
    mockRedisInstance.hincrby.mockResolvedValue(5)
    expect(await client.hincrby('k', 'f', 5)).toBe(5)
  })

  it('sadd returns 0 with no members', async () => {
    expect(await client.sadd('k')).toBe(0)
    expect(mockRedisInstance.sadd).not.toHaveBeenCalled()
  })

  it('sadd delegates to redis.sadd with members', async () => {
    mockRedisInstance.sadd.mockResolvedValue(2)
    expect(await client.sadd('k', 'a', 'b')).toBe(2)
    expect(mockRedisInstance.sadd).toHaveBeenCalledWith('k', 'a', 'b')
  })

  it('smembers delegates to redis.smembers', async () => {
    mockRedisInstance.smembers.mockResolvedValue(['a', 'b'])
    expect(await client.smembers('k')).toEqual(['a', 'b'])
  })

  it('srem returns 0 with no members', async () => {
    expect(await client.srem('k')).toBe(0)
    expect(mockRedisInstance.srem).not.toHaveBeenCalled()
  })

  it('srem delegates to redis.srem with members', async () => {
    mockRedisInstance.srem.mockResolvedValue(1)
    expect(await client.srem('k', 'a')).toBe(1)
    expect(mockRedisInstance.srem).toHaveBeenCalledWith('k', 'a')
  })

  it('del delegates to redis.del', async () => {
    mockRedisInstance.del.mockResolvedValue(1)
    expect(await client.del('k')).toBe(1)
  })

  it('expire returns true when redis returns 1', async () => {
    mockRedisInstance.expire.mockResolvedValue(1)
    expect(await client.expire('k', 60)).toBe(true)
  })

  it('expire returns false when redis returns 0', async () => {
    mockRedisInstance.expire.mockResolvedValue(0)
    expect(await client.expire('k', 60)).toBe(false)
  })

  it('scan delegates to redis.scan and normalizes cursor', async () => {
    mockRedisInstance.scan.mockResolvedValue(['5', ['a', 'b']])
    const [cursor, keys] = await client.scan(0, { match: '*', count: 10 })
    expect(mockRedisInstance.scan).toHaveBeenCalledWith(0, {
      match: '*',
      count: 10,
    })
    expect(cursor).toBe(5)
    expect(keys).toEqual(['a', 'b'])
  })

  it('eval delegates to redis.eval', async () => {
    mockRedisInstance.eval.mockResolvedValue('result')
    expect(await client.eval('script', ['k'], ['a'])).toBe('result')
  })

  it('quit resolves without calling redis', async () => {
    await expect(client.quit()).resolves.toBeUndefined()
  })

  it('raw exposes the underlying redis instance', () => {
    expect(client.raw).toBe(mockRedisInstance)
  })

  describe('pipeline', () => {
    it('chains operations and forwards to the underlying pipeline', async () => {
      const pipeline = client.pipeline()
      pipeline
        .del('k1')
        .hset('k2', { a: '1' })
        .expire('k3', 60)
        .sadd('k4', 'a', 'b')
        .srem('k5', 'a', 'b')
        .hgetall('k6')
        .setex('k7', 30, 'v')

      expect(mockRedisInstance.__pipelineInner.del).toHaveBeenCalledWith('k1')
      expect(mockRedisInstance.__pipelineInner.hset).toHaveBeenCalledWith(
        'k2',
        { a: '1' }
      )
      expect(mockRedisInstance.__pipelineInner.expire).toHaveBeenCalledWith(
        'k3',
        60
      )
      expect(mockRedisInstance.__pipelineInner.sadd).toHaveBeenCalledWith(
        'k4',
        'a',
        'b'
      )
      expect(mockRedisInstance.__pipelineInner.srem).toHaveBeenCalledWith(
        'k5',
        'a',
        'b'
      )
      expect(mockRedisInstance.__pipelineInner.hgetall).toHaveBeenCalledWith(
        'k6'
      )
      expect(mockRedisInstance.__pipelineInner.setex).toHaveBeenCalledWith(
        'k7',
        30,
        'v'
      )

      const result = await pipeline.exec()
      expect(result).toEqual(['ok'])
    })

    it('sadd/srem with no members do not call the underlying pipeline', () => {
      const pipeline = client.pipeline()
      pipeline.sadd('k')
      pipeline.srem('k')

      expect(mockRedisInstance.__pipelineInner.sadd).not.toHaveBeenCalled()
      expect(mockRedisInstance.__pipelineInner.srem).not.toHaveBeenCalled()
    })
  })
})
