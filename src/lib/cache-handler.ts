/**
 * Redis-backed Next.js 16 cache handler for Cache Components ("use cache").
 *
 * Implements the `cacheHandlers.default` module contract on top of the
 * existing `CacheClient` contract from `src/lib/cache/index.ts` — no new
 * Redis client or vendor SDK is introduced here. Wired up from
 * `next.config.ts` only when `DEPLOY_TARGET=self-hosted` and a cache backend
 * is actually configured; on Vercel (or with no cache backend) this module is
 * never loaded and Next's own default in-memory handler is used instead.
 *
 * Why this exists at all: `revalidateTag` calls only affect the process that
 * receives them under the default in-memory handler. A self-hosted deploy
 * that runs more than one instance (or is redeployed frequently) needs tag
 * revalidation to propagate across instances, which requires a shared store.
 *
 * Keys are namespaced under `nextcache:v1:` so they cannot collide with the
 * application's own Redis keys (see `src/lib/cache.ts`).
 */

import { getCacheClient } from '@/lib/cache/index'
import { logError } from '@/lib/logger'

// ── Next.js cache handler contract ──────────────────────
//
// Next.js loads this module by file path (see `cacheHandlers.default` in
// next.config.ts) rather than importing its internal types, so the shapes
// below are declared locally rather than imported from a private
// `next/dist/...` path. They mirror
// `node_modules/next/dist/server/lib/cache-handlers/types.d.ts`.

type Timestamp = number

interface CacheEntry {
  value: ReadableStream<Uint8Array>
  tags: string[]
  stale: number
  timestamp: Timestamp
  expire: number
  revalidate: number
}

interface CacheHandler {
  get(cacheKey: string, softTags: string[]): Promise<undefined | CacheEntry>
  set(cacheKey: string, pendingEntry: Promise<CacheEntry>): Promise<void>
  refreshTags(): Promise<void>
  getExpiration(tags: string[]): Promise<Timestamp>
  updateTags(tags: string[], durations?: { expire?: number }): Promise<void>
}

// ── Key namespacing ──────────────────────────────────────

const KEY_PREFIX = 'nextcache:v1:'
const entryKey = (cacheKey: string) => `${KEY_PREFIX}entry:${cacheKey}`
const tagKey = (tag: string) => `${KEY_PREFIX}tag:${tag}`

/** How long a tag's revalidation record is retained before it is dropped. */
const TAG_RECORD_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

interface StoredEntry {
  /** Base64-encoded bytes of the cached value. */
  value: string
  tags: string[]
  stale: number
  timestamp: Timestamp
  expire: number
  revalidate: number
}

interface TagRecord {
  /** Timestamp (ms) of the most recent "mark stale" update, if any. */
  stale?: Timestamp
  /** Timestamp (ms) of the most recent "mark expired" update, if any. */
  expired?: Timestamp
}

// ── Stream <-> bytes ─────────────────────────────────────

const streamToBase64 = async (
  stream: ReadableStream<Uint8Array>
): Promise<string> => {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString(
    'base64'
  )
}

const base64ToStream = (base64: string): ReadableStream<Uint8Array> => {
  const buffer = Buffer.from(base64, 'base64')
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer))
      controller.close()
    },
  })
}

// ── Handler ──────────────────────────────────────────────

const get: CacheHandler['get'] = async (cacheKey, softTags) => {
  const client = getCacheClient()
  if (!client) return undefined

  try {
    const stored = await client.get<StoredEntry>(entryKey(cacheKey))
    if (!stored) return undefined

    const now = Date.now()
    if (now > stored.timestamp + stored.expire * 1000) {
      return undefined
    }

    const relevantTags = [...stored.tags, ...softTags]
    const records = await Promise.all(
      relevantTags.map((tag) => client.get<TagRecord>(tagKey(tag)))
    )

    let revalidate = stored.revalidate
    for (const record of records) {
      if (!record) continue
      if (record.expired && record.expired > stored.timestamp) {
        // A hard/soft tag was invalidated after this entry was written —
        // treat the entry as missing entirely.
        return undefined
      }
      if (record.stale && record.stale > stored.timestamp) {
        // Force a background revalidation while still serving this value.
        revalidate = -1
      }
    }

    return {
      value: base64ToStream(stored.value),
      tags: stored.tags,
      stale: stored.stale,
      timestamp: stored.timestamp,
      expire: stored.expire,
      revalidate,
    }
  } catch (error) {
    logError({ error, context: 'cache_handler_get_failed' })
    return undefined
  }
}

const set: CacheHandler['set'] = async (cacheKey, pendingEntry) => {
  const client = getCacheClient()
  if (!client) return

  try {
    const entry = await pendingEntry

    // An `expire: 0` entry is dynamic — the "use cache" wrapper regenerates
    // it on every read, so persisting it would just be a wasted write.
    if (entry.expire <= 0) return

    const value = await streamToBase64(entry.value)
    const stored: StoredEntry = {
      value,
      tags: entry.tags,
      stale: entry.stale,
      timestamp: entry.timestamp,
      expire: entry.expire,
      revalidate: entry.revalidate,
    }

    await client.set(entryKey(cacheKey), stored, {
      ex: Number.isFinite(entry.expire) ? entry.expire : undefined,
    })
  } catch (error) {
    logError({ error, context: 'cache_handler_set_failed' })
  }
}

const refreshTags: CacheHandler['refreshTags'] = async () => {
  // Every `get`/`getExpiration` call reads tag records straight from Redis,
  // so there is no local manifest to refresh.
}

const getExpiration: CacheHandler['getExpiration'] = async (tags) => {
  const client = getCacheClient()
  if (!client || tags.length === 0) return 0

  try {
    const records = await Promise.all(
      tags.map((tag) => client.get<TagRecord>(tagKey(tag)))
    )
    return Math.max(0, ...records.map((record) => record?.expired ?? 0))
  } catch (error) {
    logError({ error, context: 'cache_handler_get_expiration_failed' })
    return 0
  }
}

const updateTags: CacheHandler['updateTags'] = async (tags, durations) => {
  const client = getCacheClient()
  if (!client) return

  const now = Date.now()

  try {
    await Promise.all(
      tags.map(async (tag) => {
        const existing = (await client.get<TagRecord>(tagKey(tag))) ?? {}
        const updated: TagRecord = durations
          ? {
              ...existing,
              stale: now,
              expired:
                durations.expire !== undefined
                  ? now + durations.expire * 1000
                  : existing.expired,
            }
          : { ...existing, expired: now }

        await client.set(tagKey(tag), updated, {
          ex: TAG_RECORD_TTL_SECONDS,
        })
      })
    )
  } catch (error) {
    logError({ error, context: 'cache_handler_update_tags_failed' })
  }
}

const cacheHandler: CacheHandler = {
  get,
  set,
  refreshTags,
  getExpiration,
  updateTags,
}

export default cacheHandler
