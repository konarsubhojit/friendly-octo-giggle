/**
 * Cache client factory.
 *
 * Resolves the configured `CacheProvider` and returns a singleton
 * `CacheClient`. All cache consumers import from here — never from a
 * vendor SDK.
 */

export type { CacheClient, CachePipeline } from './types'

import type { CacheClient } from './types'
import { getProvider } from '@/lib/providers/resolution'
import { env } from '@/lib/env'
import { logError } from '@/lib/logger'

let singleton: CacheClient | null = null

/**
 * Return the singleton cache client for the process.
 *
 * Returns `null` when the resolved provider is `none` and no credentials are
 * configured, mirroring the legacy `getRedisClient()` behaviour.
 */
export const getCacheClient = (): CacheClient | null => {
  if (singleton) return singleton

  const provider = getProvider('cache')

  switch (provider) {
    case 'upstash': {
      const url = env.UPSTASH_REDIS_REST_URL
      const token = env.UPSTASH_REDIS_REST_TOKEN
      if (!url || !token) return null
      // Dynamic import would be cleaner, but we need synchronous return.
      // The Upstash adapter is tiny and HTTP-only.
      const { UpstashCacheClient } = require('./upstash-adapter') as typeof import('./upstash-adapter')
      singleton = new UpstashCacheClient(url, token)
      return singleton
    }

    case 'redis': {
      const url = env.REDIS_URL
      if (!url) return null
      const { NodeRedisCacheClient } = require('./node-redis-adapter') as typeof import('./node-redis-adapter')
      const client = new NodeRedisCacheClient(url, {
        onError: (err) =>
          logError({
            error: err,
            context: 'node_redis_connection',
          }),
      })
      // Fire-and-forget connect; commands queue until ready.
      client.connect().catch((err: unknown) =>
        logError({ error: err, context: 'node_redis_initial_connect' })
      )
      singleton = client
      return singleton
    }

    case 'none':
    default:
      return null
  }
}

/**
 * Convenience: true when a cache backend is configured and ready.
 */
export const isCacheAvailable = (): boolean => {
  const client = getCacheClient()
  return client !== null && client.isReady
}

/** Exposed for tests that need to swap the singleton. */
export const __resetCacheClientForTests = (): void => {
  singleton = null
}
