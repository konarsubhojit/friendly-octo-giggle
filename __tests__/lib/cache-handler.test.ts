import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CacheClient } from '@/lib/cache/types'

const { mockGetCacheClient } = vi.hoisted(() => ({
  mockGetCacheClient: vi.fn(),
}))

vi.mock('@/lib/cache/index', () => ({
  getCacheClient: mockGetCacheClient,
}))

/**
 * A minimal in-memory fake of the app-owned `CacheClient` contract, covering
 * only the operations `src/lib/cache-handler.ts` actually calls (get/set with
 * an optional `ex`). This mirrors real adapter semantics: JSON in, JSON out.
 */
const createFakeCacheClient = (): CacheClient => {
  const store = new Map<string, unknown>()

  return {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
      return 'OK'
    }),
    setex: vi.fn(async () => 'OK'),
    hset: vi.fn(async () => 0),
    hgetall: vi.fn(async () => null),
    hincrby: vi.fn(async () => 0),
    sadd: vi.fn(async () => 0),
    smembers: vi.fn(async () => []),
    srem: vi.fn(async () => 0),
    del: vi.fn(async () => 0),
    expire: vi.fn(async () => true),
    scan: vi.fn(async () => [0, []]),
    pipeline: vi.fn(),
    eval: vi.fn(async () => null),
    quit: vi.fn(async () => undefined),
    isReady: true,
  } as unknown as CacheClient
}

const streamFromString = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })

const readStreamAsString = async (
  stream: ReadableStream<Uint8Array>
): Promise<string> => {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

describe('cache-handler', () => {
  let fakeClient: CacheClient

  beforeEach(() => {
    vi.clearAllMocks()
    fakeClient = createFakeCacheClient()
    mockGetCacheClient.mockReturnValue(fakeClient)
  })

  it('round-trips a value through set then get', async () => {
    const { default: cacheHandler } = await import('@/lib/cache-handler')

    const timestamp = Date.now()
    await cacheHandler.set(
      'key-1',
      Promise.resolve({
        value: streamFromString('hello world'),
        tags: ['product:abc123'],
        stale: 60,
        timestamp,
        expire: 3600,
        revalidate: 900,
      })
    )

    const entry = await cacheHandler.get('key-1', [])
    expect(entry).toBeDefined()
    expect(await readStreamAsString(entry!.value)).toBe('hello world')
    expect(entry!.tags).toEqual(['product:abc123'])
    expect(entry!.revalidate).toBe(900)
  })

  it('misses a key that was never set', async () => {
    const { default: cacheHandler } = await import('@/lib/cache-handler')
    const entry = await cacheHandler.get('missing-key', [])
    expect(entry).toBeUndefined()
  })

  it('does not persist a dynamic (expire: 0) entry', async () => {
    const { default: cacheHandler } = await import('@/lib/cache-handler')

    await cacheHandler.set(
      'dynamic-key',
      Promise.resolve({
        value: streamFromString('dynamic'),
        tags: [],
        stale: 0,
        timestamp: Date.now(),
        expire: 0,
        revalidate: 0,
      })
    )

    expect(await cacheHandler.get('dynamic-key', [])).toBeUndefined()
  })

  it('treats an entry as expired once its expire window has elapsed', async () => {
    const { default: cacheHandler } = await import('@/lib/cache-handler')

    await cacheHandler.set(
      'stale-entry',
      Promise.resolve({
        value: streamFromString('old'),
        tags: [],
        stale: 0,
        timestamp: Date.now() - 10_000,
        expire: 1, // 1 second — already elapsed
        revalidate: 1,
      })
    )

    expect(await cacheHandler.get('stale-entry', [])).toBeUndefined()
  })

  it('invalidates an entry once one of its tags is revalidated', async () => {
    const { default: cacheHandler } = await import('@/lib/cache-handler')
    const timestamp = Date.now() - 5_000

    await cacheHandler.set(
      'tagged-entry',
      Promise.resolve({
        value: streamFromString('tagged value'),
        tags: ['product:xyz'],
        stale: 60,
        timestamp,
        expire: 3600,
        revalidate: 900,
      })
    )

    expect(await cacheHandler.get('tagged-entry', [])).toBeDefined()

    await cacheHandler.updateTags(['product:xyz'])

    expect(await cacheHandler.get('tagged-entry', [])).toBeUndefined()
  })

  it('leaves an untagged entry unaffected by an unrelated tag revalidation', async () => {
    const { default: cacheHandler } = await import('@/lib/cache-handler')
    const timestamp = Date.now() - 5_000

    await cacheHandler.set(
      'other-entry',
      Promise.resolve({
        value: streamFromString('unrelated value'),
        tags: ['product:other'],
        stale: 60,
        timestamp,
        expire: 3600,
        revalidate: 900,
      })
    )

    await cacheHandler.updateTags(['product:xyz'])

    expect(await cacheHandler.get('other-entry', [])).toBeDefined()
  })

  it('reports getExpiration as the max revalidation timestamp across tags', async () => {
    const { default: cacheHandler } = await import('@/lib/cache-handler')

    expect(await cacheHandler.getExpiration(['product:new-tag'])).toBe(0)

    await cacheHandler.updateTags(['product:new-tag'])
    const expiration = await cacheHandler.getExpiration(['product:new-tag'])

    expect(expiration).toBeGreaterThan(0)
  })

  it('degrades to always-miss / no-op writes when no cache client is configured', async () => {
    mockGetCacheClient.mockReturnValue(null)
    const { default: cacheHandler } = await import('@/lib/cache-handler')

    await cacheHandler.set(
      'no-client-key',
      Promise.resolve({
        value: streamFromString('value'),
        tags: [],
        stale: 60,
        timestamp: Date.now(),
        expire: 3600,
        revalidate: 900,
      })
    )

    expect(await cacheHandler.get('no-client-key', [])).toBeUndefined()
    expect(await cacheHandler.getExpiration(['some-tag'])).toBe(0)
    await expect(cacheHandler.updateTags(['some-tag'])).resolves.toBeUndefined()
    await expect(cacheHandler.refreshTags()).resolves.toBeUndefined()
  })
})
