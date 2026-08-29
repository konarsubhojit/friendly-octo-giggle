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

  async get<T>(_key: string): Promise<T | null> {
    return null
  }
  async set(_key: string, _value: unknown, _options?: { ex?: number; nx?: boolean }): Promise<string | null> {
    return null
  }
  async setex(_key: string, _seconds: number, _value: unknown): Promise<string | null> {
    return null
  }

  async hset(_key: string, _fields: Record<string, unknown>): Promise<number> {
    return 0
  }
  async hgetall(_key: string): Promise<null> {
    return null
  }
  async hincrby(_key: string, _field: string, _increment: number): Promise<number> {
    return 0
  }

  async sadd(_key: string, ..._members: string[]): Promise<number> {
    return 0
  }
  async smembers(_key: string): Promise<string[]> {
    return []
  }
  async srem(_key: string, ..._members: string[]): Promise<number> {
    return 0
  }

  async del(_key: string): Promise<number> {
    return 0
  }
  async expire(_key: string, _seconds: number): Promise<boolean> {
    return false
  }
  async scan(_cursor: number, _options?: { match?: string; count?: number }): Promise<[number, string[]]> {
    return [0, []]
  }

  pipeline(): CachePipeline {
    return new NullPipeline()
  }
  async eval(_script: string, _keys: string[], _args: string[]): Promise<unknown> {
    return null
  }
  async quit(): Promise<void> {}
}
