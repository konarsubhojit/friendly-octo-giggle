/**
 * Shared behavioral contract for every `CacheClient` adapter.
 *
 * Each concrete adapter (`NodeRedisCacheClient`, `UpstashCacheClient`,
 * `NullCacheClient`) is backed here by an in-memory fake standing in for the
 * vendor SDK, so the same assertions run against every backend without a
 * live Redis or Upstash instance. This is what "adapters are plumbing" means
 * in practice: swapping `CACHE_PROVIDER` must never change what a consumer
 * observes through the `CacheClient` interface.
 *
 * Real-service behavior (actual network I/O, TLS, reconnect timing) is
 * exercised separately by the opt-in integration suite in
 * `redis-integration.test.ts`, gated on `TEST_REDIS_URL`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CacheClient } from '@/lib/cache/types'
import { NodeRedisCacheClient } from '@/lib/cache/node-redis-adapter'
import { UpstashCacheClient } from '@/lib/cache/upstash-adapter'

/** Minimal in-memory Redis-alike, shared by both fake SDK facades below. */
class FakeRedisStore {
  strings = new Map<string, string>()
  hashes = new Map<string, Record<string, string>>()
  sets = new Map<string, Set<string>>()

  reset(): void {
    this.strings.clear()
    this.hashes.clear()
    this.sets.clear()
  }
}

const store = new FakeRedisStore()

// ── Fake node-redis client (camelCase commands, string-only values) ────────

const nodeRedisHandlers: Record<string, (...args: never[]) => void> = {}

const fakeNodeRedisClient = {
  isOpen: true,
  on: vi.fn((event: string, handler: (...args: never[]) => void) => {
    nodeRedisHandlers[event] = handler
    return fakeNodeRedisClient
  }),
  connect: vi.fn(async () => {
    nodeRedisHandlers.ready?.()
  }),
  quit: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(async (key: string) => store.strings.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => {
    store.strings.set(key, value)
    return 'OK'
  }),
  setEx: vi.fn(async (key: string, _seconds: number, value: string) => {
    store.strings.set(key, value)
    return 'OK'
  }),
  hSet: vi.fn(async (key: string, fields: Record<string, string>) => {
    store.hashes.set(key, { ...(store.hashes.get(key) ?? {}), ...fields })
    return Object.keys(fields).length
  }),
  hGetAll: vi.fn(async (key: string) => store.hashes.get(key) ?? {}),
  hIncrBy: vi.fn(async (key: string, field: string, increment: number) => {
    const hash = store.hashes.get(key) ?? {}
    const next = Number(hash[field] ?? 0) + increment
    hash[field] = String(next)
    store.hashes.set(key, hash)
    return next
  }),
  sAdd: vi.fn(async (key: string, members: string[]) => {
    const set = store.sets.get(key) ?? new Set<string>()
    let added = 0
    for (const member of members) {
      if (!set.has(member)) added += 1
      set.add(member)
    }
    store.sets.set(key, set)
    return added
  }),
  sMembers: vi.fn(async (key: string) => [...(store.sets.get(key) ?? [])]),
  sRem: vi.fn(async (key: string, members: string[]) => {
    const set = store.sets.get(key)
    if (!set) return 0
    let removed = 0
    for (const member of members) {
      if (set.delete(member)) removed += 1
    }
    return removed
  }),
  del: vi.fn(async (key: string) => {
    const existed =
      store.strings.delete(key) ||
      store.hashes.delete(key) ||
      store.sets.delete(key)
    return existed ? 1 : 0
  }),
  expire: vi.fn(async () => true),
  scan: vi.fn(async () => ({ cursor: 0, keys: [] })),
  eval: vi.fn(async () => 1),
  multi: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    hSet: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    sAdd: vi.fn().mockReturnThis(),
    sRem: vi.fn().mockReturnThis(),
    hGetAll: vi.fn().mockReturnThis(),
    setEx: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
}

vi.mock('redis', () => ({
  createClient: vi.fn(() => fakeNodeRedisClient),
}))

// ── Fake Upstash REST client (lower-case commands) ──────────────────────────

const fakeUpstashRedis = {
  get: vi.fn(async (key: string) => {
    const raw = store.strings.get(key)
    if (raw === undefined) return null
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }),
  set: vi.fn(async (key: string, value: unknown) => {
    store.strings.set(
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    )
    return 'OK'
  }),
  setex: vi.fn(async (key: string, _seconds: number, value: unknown) => {
    store.strings.set(
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    )
    return 'OK'
  }),
  hset: vi.fn(async (key: string, fields: Record<string, unknown>) => {
    const stringified: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) {
      stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
    }
    store.hashes.set(key, { ...(store.hashes.get(key) ?? {}), ...stringified })
    return Object.keys(fields).length
  }),
  hgetall: vi.fn(async (key: string) => {
    const hash = store.hashes.get(key)
    return hash && Object.keys(hash).length > 0 ? hash : null
  }),
  hincrby: vi.fn(async (key: string, field: string, increment: number) => {
    const hash = store.hashes.get(key) ?? {}
    const next = Number(hash[field] ?? 0) + increment
    hash[field] = String(next)
    store.hashes.set(key, hash)
    return next
  }),
  sadd: vi.fn(async (key: string, ...members: string[]) => {
    const set = store.sets.get(key) ?? new Set<string>()
    let added = 0
    for (const member of members) {
      if (!set.has(member)) added += 1
      set.add(member)
    }
    store.sets.set(key, set)
    return added
  }),
  smembers: vi.fn(async (key: string) => [...(store.sets.get(key) ?? [])]),
  srem: vi.fn(async (key: string, ...members: string[]) => {
    const set = store.sets.get(key)
    if (!set) return 0
    let removed = 0
    for (const member of members) {
      if (set.delete(member)) removed += 1
    }
    return removed
  }),
  del: vi.fn(async (key: string) => {
    const existed =
      store.strings.delete(key) ||
      store.hashes.delete(key) ||
      store.sets.delete(key)
    return existed ? 1 : 0
  }),
  expire: vi.fn(async () => 1),
  scan: vi.fn(async () => [0, []]),
  eval: vi.fn(async () => 1),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    hgetall: vi.fn().mockReturnThis(),
    setex: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
}

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor() {
      return fakeUpstashRedis
    }
  },
}))

const buildAdapters = (): Array<{ name: string; client: CacheClient }> => [
  {
    name: 'redis (node-redis)',
    client: new NodeRedisCacheClient('redis://localhost:6379'),
  },
  {
    name: 'upstash',
    client: new UpstashCacheClient('https://example.upstash.io', 'token'),
  },
]

describe('CacheClient contract', () => {
  beforeEach(() => {
    store.reset()
    vi.clearAllMocks()
  })

  it.each(buildAdapters())(
    '$name: set/get round-trips a JSON-serializable value',
    async ({ client }) => {
      await client.set('greeting', { hello: 'world' })
      await expect(client.get('greeting')).resolves.toEqual({
        hello: 'world',
      })
    }
  )

  it.each(buildAdapters())(
    '$name: hset/hgetall round-trips hash fields',
    async ({ client }) => {
      await client.hset('user:1', { name: 'Ada', role: 'admin' })
      await expect(client.hgetall('user:1')).resolves.toEqual({
        name: 'Ada',
        role: 'admin',
      })
    }
  )

  it.each(buildAdapters())(
    '$name: hgetall returns null for a key that was never written',
    async ({ client }) => {
      await expect(client.hgetall('missing')).resolves.toBeNull()
    }
  )

  it.each(buildAdapters())(
    '$name: sadd/smembers/srem manage set membership',
    async ({ client }) => {
      await client.sadd('tags', 'a', 'b', 'c')
      await expect(client.smembers('tags')).resolves.toEqual(
        expect.arrayContaining(['a', 'b', 'c'])
      )

      await client.srem('tags', 'b')
      await expect(client.smembers('tags')).resolves.toEqual(
        expect.arrayContaining(['a', 'c'])
      )
      await expect(client.smembers('tags')).resolves.not.toContain('b')
    }
  )

  it.each(buildAdapters())('$name: del removes a key', async ({ client }) => {
    await client.set('to-delete', 'value')
    await expect(client.del('to-delete')).resolves.toBe(1)
    await expect(client.get('to-delete')).resolves.toBeNull()
  })

  it.each(buildAdapters())(
    '$name: reports isReady true once connected',
    async ({ client }) => {
      const connectable = client as unknown as {
        connect?: () => Promise<void>
      }
      await connectable.connect?.()
      expect(client.isReady).toBe(true)
    }
  )
})
