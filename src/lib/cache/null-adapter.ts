/**
 * No-op cache adapter.
 *
 * Every method returns the "not found" / "not applicable" sentinel so callers
 * fall through to their fetcher or skip caching entirely. Used when
 * `CACHE_PROVIDER=none`.
 */

import type { CacheClient, CachePipeline } from './types'

class NullPipeline implements CachePipeline {
  private results: unknown[] = []

  del(): this {
    this.results.push(0)
    return this
  }
  hset(): this {
    this.results.push(0)
    return this
  }
  expire(): this {
    this.results.push(false)
    return this
  }
  sadd(): this {
    this.results.push(0)
    return this
  }
  srem(): this {
    this.results.push(0)
    return this
  }
  hgetall(): this {
    this.results.push(null)
    return this
  }
  setex(): this {
    this.results.push(null)
    return this
  }

  async exec(): Promise<unknown[]> {
    const out = [...this.results]
    this.results = []
    return out
  }
}

export class NullCacheClient implements CacheClient {
  readonly isReady = false

  async get<T>(): Promise<T | null> {
    return null
  }
  async set(): Promise<string | null> {
    return null
  }
  async setex(): Promise<string | null> {
    return null
  }

  async hset(): Promise<number> {
    return 0
  }
  async hgetall(): Promise<null> {
    return null
  }

  async sadd(): Promise<number> {
    return 0
  }
  async smembers(): Promise<string[]> {
    return []
  }
  async srem(): Promise<number> {
    return 0
  }

  async del(): Promise<number> {
    return 0
  }
  async expire(): Promise<boolean> {
    return false
  }
  async scan(): Promise<[number, string[]]> {
    return [0, []]
  }

  pipeline(): CachePipeline {
    return new NullPipeline()
  }
  async eval(): Promise<unknown> {
    return null
  }
  async quit(): Promise<void> {}
}
