/**
 * Upstash REST adapter for the app-owned cache contract.
 *
 * Wraps `@upstash/redis` behind `CacheClient` so that no consumer module
 * imports the vendor SDK directly. Edge-safe (HTTP-based, no TCP).
 */

import { Redis } from '@upstash/redis'
import type { CacheClient, CachePipeline } from './types'

class UpstashPipeline implements CachePipeline {
  constructor(private readonly inner: ReturnType<Redis['pipeline']>) {}

  del(key: string): this {
    this.inner.del(key)
    return this
  }
  hset(key: string, fields: Record<string, unknown>): this {
    this.inner.hset(key, fields)
    return this
  }
  expire(key: string, seconds: number): this {
    this.inner.expire(key, seconds)
    return this
  }
  sadd(key: string, ...members: string[]): this {
    for (const m of members) this.inner.sadd(key, m)
    return this
  }
  srem(key: string, ...members: string[]): this {
    for (const m of members) this.inner.srem(key, m)
    return this
  }
  hgetall(key: string): this {
    this.inner.hgetall(key)
    return this
  }
  setex(key: string, seconds: number, value: unknown): this {
    this.inner.setex(key, seconds, value)
    return this
  }
  async exec(): Promise<unknown[]> {
    return this.inner.exec()
  }
}

export class UpstashCacheClient implements CacheClient {
  private readonly redis: Redis
  readonly isReady: boolean

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token })
    this.isReady = true
  }

  async get<T>(key: string): Promise<T | null> {
    return this.redis.get<T>(key)
  }

  async set(
    key: string,
    value: unknown,
    options?: { ex?: number; nx?: boolean }
  ): Promise<string | null> {
    return this.redis.set(key, value, {
      ...(options?.ex !== undefined ? { ex: options.ex } : {}),
      ...(options?.nx ? { nx: true } : {}),
    })
  }

  async setex(
    key: string,
    seconds: number,
    value: unknown
  ): Promise<string | null> {
    return this.redis.setex(key, seconds, value)
  }

  async hset(key: string, fields: Record<string, unknown>): Promise<number> {
    return this.redis.hset(key, fields)
  }

  async hgetall<T extends Record<string, string>>(
    key: string
  ): Promise<T | null> {
    return this.redis.hgetall<T>(key)
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0
    if (members.length === 1) return this.redis.sadd(key, members[0])
    let total = 0
    for (const m of members) total += await this.redis.sadd(key, m)
    return total
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key)
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0
    if (members.length === 1) return this.redis.srem(key, members[0])
    let total = 0
    for (const m of members) total += await this.redis.srem(key, m)
    return total
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key)
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.redis.expire(key, seconds)
    return result === 1
  }

  async scan(
    cursor: number,
    options?: { match?: string; count?: number }
  ): Promise<[number, string[]]> {
    const [nextCursor, keys] = await this.redis.scan(cursor, {
      match: options?.match,
      count: options?.count,
    })
    return [Number(nextCursor), keys]
  }

  pipeline(): CachePipeline {
    return new UpstashPipeline(this.redis.pipeline())
  }

  async eval(
    script: string,
    keys: string[],
    args: string[]
  ): Promise<unknown> {
    return this.redis.eval(script, keys, args)
  }

  async quit(): Promise<void> {
    // Upstash is HTTP-based — no persistent connection to close.
  }

  /**
   * Expose the underlying Upstash `Redis` instance for search-specific code
   * that needs vendor-specific APIs (e.g. `redis.search.*`).  Consumers
   * should prefer the `CacheClient` surface wherever possible.
   */
  get raw(): Redis {
    return this.redis
  }
}
