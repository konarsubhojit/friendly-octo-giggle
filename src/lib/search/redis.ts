/**
 * Search-specific Upstash Redis client.
 *
 * Order search indexing requires RediSearch vendor APIs (`redis.search.*`)
 * which are NOT part of the generic cache contract. This module owns its
 * own `@upstash/redis` client for that purpose.
 */

import { Redis } from '@upstash/redis'
import { env } from '@/lib/env'

let searchRedis: Redis | null = null

export const isSearchRedisAvailable = (): boolean =>
  Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)

export const getSearchRedisClient = (): Redis | null => {
  if (!isSearchRedisAvailable()) return null
  searchRedis ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  })
  return searchRedis
}
