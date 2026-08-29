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
    const [member, ...rest] = members
    if (member !== undefined) this.inner.sadd(key, member, ...rest)
    return this
  }
  srem(key: string, ...members: string[]): this {
    const [member, ...rest] = members
    if (member !== undefined) this.inner.srem(key, member, ...rest)
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
    // Upstash uses a discriminated union for set options — build a concrete
    // variant to satisfy the type checker.
    if (options?.ex !== undefined && options?.nx) {
      return this.redis.set(key, value, { ex: options.ex, nx: true }) as Promise<string | null>
    }
    if (options?.ex !== undefined) {
      return this.redis.set(key, value, { ex: options.ex }) as Promise<string | null>
    }
    if (options?.nx) {
      return this.redis.set(key, value, { nx: true }) as Promise<string | null>
    }
    return this.redis.set(key, value) as Promise<string | null>
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

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.redis.hincrby(key, field, increment)
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const [member, ...rest] = members
    if (member === undefined) return 0
    return this.redis.sadd(key, member, ...rest)
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key)
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const [member, ...rest] = members
    if (member === undefined) return 0
    return this.redis.srem(key, member, ...rest)
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
