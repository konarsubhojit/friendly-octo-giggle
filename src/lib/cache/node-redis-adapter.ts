/**
 * Standard Node Redis adapter for the app-owned cache contract.
 *
 * Uses the `redis` npm package (Node Redis protocol client). This adapter is
 * SERVER-ONLY — it opens a TCP/TLS connection and must never be imported from
 * edge/middleware paths.
 *
 * Lifecycle: the client auto-reconnects on transient failures with
 * exponential backoff (100 ms → 3 s cap). Health is reflected via `isReady`.
 * Call `quit()` for a graceful shutdown.
 */

import { createClient, type RedisClientType } from 'redis'
import type { CacheClient, CachePipeline } from './types'

// ── Configuration ───────────────────────────────────────

const RECONNECT_BASE_MS = 100
const RECONNECT_CAP_MS = 3_000
const CONNECT_TIMEOUT_MS = 5_000
const COMMAND_TIMEOUT_MS = 3_000

// ── Pipeline adapter ────────────────────────────────────

class NodeRedisPipeline implements CachePipeline {
  private readonly multi: ReturnType<RedisClientType['multi']>

  constructor(client: RedisClientType) {
    this.multi = client.multi()
  }

  del(key: string): this {
    this.multi.del(key)
    return this
  }

  hset(key: string, fields: Record<string, unknown>): this {
    // node redis expects Record<string, string>
    const stringified: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) {
      stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
    }
    this.multi.hSet(key, stringified)
    return this
  }

  expire(key: string, seconds: number): this {
    this.multi.expire(key, seconds)
    return this
  }

  sadd(key: string, ...members: string[]): this {
    if (members.length > 0) this.multi.sAdd(key, members)
    return this
  }

  srem(key: string, ...members: string[]): this {
    if (members.length > 0) this.multi.sRem(key, members)
    return this
  }

  hgetall(key: string): this {
    this.multi.hGetAll(key)
    return this
  }

  setex(key: string, seconds: number, value: unknown): this {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    this.multi.setEx(key, seconds, serialized)
    return this
  }

  async exec(): Promise<unknown[]> {
    return this.multi.exec()
  }
}

// ── Client adapter ──────────────────────────────────────

export class NodeRedisCacheClient implements CacheClient {
  private client: RedisClientType
  private _isReady = false
  private readonly _onError?: (err: Error) => void

  constructor(
    url: string,
    options?: { onError?: (err: Error) => void }
  ) {
    this._onError = options?.onError

    this.client = createClient({
      url,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: (retries) => {
          const delay = Math.min(
            RECONNECT_BASE_MS * Math.pow(2, retries),
            RECONNECT_CAP_MS
          )
          return delay
        },
      },
      commandsQueueMaxLength: undefined,
    }) as unknown as RedisClientType

    this.client.on('ready', () => {
      this._isReady = true
    })
    this.client.on('end', () => {
      this._isReady = false
    })
    this.client.on('error', (err: Error) => {
      this._isReady = false
      this._onError?.(err)
    })
  }

  /** Connect to Redis. Must be called once before issuing commands. */
  async connect(): Promise<void> {
    await this.client.connect()
  }

  get isReady(): boolean {
    return this._isReady
  }

  // ── Strings ───────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.withTimeout(this.client.get(key))
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as unknown as T
    }
  }

  async set(
    key: string,
    value: unknown,
    options?: { ex?: number; nx?: boolean }
  ): Promise<string | null> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    const opts: Record<string, unknown> = {}
    if (options?.ex !== undefined) opts.EX = options.ex
    if (options?.nx) opts.NX = true
    const result = await this.withTimeout(
      this.client.set(key, serialized, opts)
    )
    return result ?? null
  }

  async setex(
    key: string,
    seconds: number,
    value: unknown
  ): Promise<string | null> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    const result = await this.withTimeout(
      this.client.setEx(key, seconds, serialized)
    )
    return result ?? null
  }

  // ── Hashes ────────────────────────────────────────────

  async hset(key: string, fields: Record<string, unknown>): Promise<number> {
    const stringified: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) {
      stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
    }
    return this.withTimeout(this.client.hSet(key, stringified))
  }

  async hgetall<T extends Record<string, string>>(
    key: string
  ): Promise<T | null> {
    const result = await this.withTimeout(this.client.hGetAll(key))
    if (!result || Object.keys(result).length === 0) return null
    return result as T
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.withTimeout(this.client.hIncrBy(key, field, increment))
  }

  // ── Sets ──────────────────────────────────────────────

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0
    return this.withTimeout(this.client.sAdd(key, members))
  }

  async smembers(key: string): Promise<string[]> {
    return this.withTimeout(this.client.sMembers(key))
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0
    return this.withTimeout(this.client.sRem(key, members))
  }

  // ── Key-level ─────────────────────────────────────────

  async del(key: string): Promise<number> {
    return this.withTimeout(this.client.del(key))
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return this.withTimeout(this.client.expire(key, seconds))
  }

  async scan(
    cursor: number,
    options?: { match?: string; count?: number }
  ): Promise<[number, string[]]> {
    const result = await this.withTimeout(
      this.client.scan(cursor, {
        MATCH: options?.match,
        COUNT: options?.count,
      })
    )
    return [result.cursor, result.keys]
  }

  // ── Pipeline / scripting ──────────────────────────────

  pipeline(): CachePipeline {
    return new NodeRedisPipeline(this.client)
  }

  async eval(
    script: string,
    keys: string[],
    args: string[]
  ): Promise<unknown> {
    return this.withTimeout(
      this.client.eval(script, { keys, arguments: args })
    )
  }

  // ── Lifecycle ─────────────────────────────────────────

  async quit(): Promise<void> {
    await this.client.quit()
    this._isReady = false
  }

  /** Ping for health-check diagnostics. */
  async ping(): Promise<string> {
    return this.withTimeout(this.client.ping())
  }

  // ── Internal ──────────────────────────────────────────

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timerId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<T>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error('Redis command timed out')),
        COMMAND_TIMEOUT_MS
      )
    })
    return Promise.race([promise, timeout]).finally(() =>
      clearTimeout(timerId)
    )
  }
}
