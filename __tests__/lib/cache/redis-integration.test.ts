/**
 * The cache contract, exercised against a real Redis server.
 *
 * `contract.test.ts` proves every adapter *shape* is interchangeable against
 * a faked SDK; this suite proves the real `NodeRedisCacheClient` actually
 * round-trips through TCP against a real Redis instance — the two failure
 * modes a fake cannot reproduce (connection handshake, real serialization).
 *
 * It is opt-in — set `CACHE_TEST_REDIS_URL` to a disposable Redis instance
 * (for example the `redis:7-alpine` service the CI provider-matrix job
 * starts) and re-run `npm test`. Without that variable the suite is skipped,
 * so the default unit run stays hermetic.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { NodeRedisCacheClient } from '@/lib/cache/node-redis-adapter'

const TEST_REDIS_URL = process.env.CACHE_TEST_REDIS_URL
const KEY_PREFIX = 'contract-test:'

describe.skipIf(!TEST_REDIS_URL)(
  'NodeRedisCacheClient against a real Redis server',
  () => {
    let client: NodeRedisCacheClient

    beforeAll(async () => {
      client = new NodeRedisCacheClient(TEST_REDIS_URL!)
      await client.connect()
    })

    afterAll(async () => {
      await client.quit()
    })

    beforeEach(async () => {
      for (const key of [
        `${KEY_PREFIX}string`,
        `${KEY_PREFIX}hash`,
        `${KEY_PREFIX}set`,
      ]) {
        await client.del(key)
      }
    })

    it('reports isReady once connected', () => {
      expect(client.isReady).toBe(true)
    })

    it('set/get round-trips a JSON-serializable value with a TTL', async () => {
      await client.set(`${KEY_PREFIX}string`, { hello: 'world' }, { ex: 60 })
      await expect(client.get(`${KEY_PREFIX}string`)).resolves.toEqual({
        hello: 'world',
      })
    })

    it('set with nx only writes once', async () => {
      const first = await client.set(`${KEY_PREFIX}string`, 'a', { nx: true })
      const second = await client.set(`${KEY_PREFIX}string`, 'b', { nx: true })
      expect(first).toBe('OK')
      expect(second).toBeNull()
      await expect(client.get(`${KEY_PREFIX}string`)).resolves.toBe('a')
    })

    it('hset/hgetall round-trips hash fields', async () => {
      await client.hset(`${KEY_PREFIX}hash`, { name: 'Ada', role: 'admin' })
      await expect(client.hgetall(`${KEY_PREFIX}hash`)).resolves.toEqual({
        name: 'Ada',
        role: 'admin',
      })
    })

    it('sadd/smembers/srem manage set membership', async () => {
      await client.sadd(`${KEY_PREFIX}set`, 'a', 'b', 'c')
      const members = await client.smembers(`${KEY_PREFIX}set`)
      expect(members.sort()).toEqual(['a', 'b', 'c'])

      await client.srem(`${KEY_PREFIX}set`, 'b')
      const remaining = await client.smembers(`${KEY_PREFIX}set`)
      expect(remaining.sort()).toEqual(['a', 'c'])
    })

    it('del removes a key', async () => {
      await client.set(`${KEY_PREFIX}string`, 'value')
      await expect(client.del(`${KEY_PREFIX}string`)).resolves.toBe(1)
      await expect(client.get(`${KEY_PREFIX}string`)).resolves.toBeNull()
    })
  }
)
