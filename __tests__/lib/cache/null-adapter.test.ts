import { describe, it, expect } from 'vitest'
import { NullCacheClient } from '@/lib/cache/null-adapter'

describe('NullCacheClient', () => {
  const client = new NullCacheClient()

  it('reports isReady as false', () => {
    expect(client.isReady).toBe(false)
  })

  it('get returns null', async () => {
    expect(await client.get('any')).toBeNull()
  })

  it('set returns null', async () => {
    expect(await client.set('k', 'v')).toBeNull()
  })

  it('setex returns null', async () => {
    expect(await client.setex('k', 60, 'v')).toBeNull()
  })

  it('hset returns 0', async () => {
    expect(await client.hset('k', { a: '1' })).toBe(0)
  })

  it('hgetall returns null', async () => {
    expect(await client.hgetall('k')).toBeNull()
  })

  it('sadd returns 0', async () => {
    expect(await client.sadd('k', 'a')).toBe(0)
  })

  it('smembers returns empty array', async () => {
    expect(await client.smembers('k')).toEqual([])
  })

  it('srem returns 0', async () => {
    expect(await client.srem('k', 'a')).toBe(0)
  })

  it('del returns 0', async () => {
    expect(await client.del('k')).toBe(0)
  })

  it('expire returns false', async () => {
    expect(await client.expire('k', 60)).toBe(false)
  })

  it('scan returns empty cursor', async () => {
    expect(await client.scan(0)).toEqual([0, []])
  })

  it('pipeline exec returns results', async () => {
    const pipe = client.pipeline()
    pipe.del('k').hset('k', { a: '1' }).expire('k', 60)
    const results = await pipe.exec()
    expect(results).toEqual([0, 0, false])
  })

  it('eval returns null', async () => {
    expect(await client.eval('return 1', [], [])).toBeNull()
  })

  it('quit resolves', async () => {
    await expect(client.quit()).resolves.toBeUndefined()
  })
})
