/**
 * App-owned cache contract.
 *
 * Every cache consumer depends on this interface — never on a vendor SDK
 * directly. Adapters for Upstash REST, standard Node Redis, and an explicit
 * no-op ("none") live alongside this file.
 *
 * The surface covers the operations the application actually uses today:
 *   - typed get / set / setex / conditional SET NX+TTL
 *   - hashes (hset / hgetall / expire)
 *   - sets (sadd / smembers / srem)
 *   - delete / scan / pipeline / script eval
 *
 * Search-specific Redis modules (RediSearch, `redis.search.*`) are NOT part of
 * this contract. Order search indexing owns its own adapter/client.
 */

// ── Pipeline ────────────────────────────────────────────

/** A pipeline accumulates commands and executes them in a single round-trip. */
export interface CachePipeline {
  del(key: string): CachePipeline
  hset(key: string, fields: Record<string, unknown>): CachePipeline
  expire(key: string, seconds: number): CachePipeline
  sadd(key: string, ...members: string[]): CachePipeline
  srem(key: string, ...members: string[]): CachePipeline
  hgetall(key: string): CachePipeline
  setex(key: string, seconds: number, value: unknown): CachePipeline
  exec(): Promise<unknown[]>
}

// ── Cache client ────────────────────────────────────────

export interface CacheClient {
  // ── Strings ───────────────────────────────────────────
  get<T = unknown>(key: string): Promise<T | null>
  set(
    key: string,
    value: unknown,
    options?: { ex?: number; nx?: boolean }
  ): Promise<string | null>
  setex(key: string, seconds: number, value: unknown): Promise<string | null>

  // ── Hashes ────────────────────────────────────────────
  hset(key: string, fields: Record<string, unknown>): Promise<number>
  hgetall<T extends Record<string, string> = Record<string, string>>(
    key: string
  ): Promise<T | null>
  hincrby(key: string, field: string, increment: number): Promise<number>

  // ── Sets ──────────────────────────────────────────────
  sadd(key: string, ...members: string[]): Promise<number>
  smembers(key: string): Promise<string[]>
  srem(key: string, ...members: string[]): Promise<number>

  // ── Key-level ─────────────────────────────────────────
  del(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<boolean>
  scan(
    cursor: number,
    options?: { match?: string; count?: number }
  ): Promise<[cursor: number, keys: string[]]>

  // ── Pipeline / scripting ──────────────────────────────
  pipeline(): CachePipeline
  eval(script: string, keys: string[], args: string[]): Promise<unknown>

  // ── Lifecycle ─────────────────────────────────────────
  /** Graceful shutdown. Implementations that have no connection may no-op. */
  quit(): Promise<void>

  /** True when the client has an active connection / is configured. */
  readonly isReady: boolean
}

// ── Cache provider identifier (re-exported for convenience) ─────────
export type { CacheProvider } from '@/lib/providers/types'
