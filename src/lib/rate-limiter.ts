/**
 * App-owned rate limiter contract and factory.
 *
 * Provides a provider-agnostic `RateLimiter` interface backed by:
 *   - **upstash** — `@upstash/ratelimit` over Upstash REST (edge-safe)
 *   - **redis**  — sliding-window implemented on standard Node Redis
 *   - **memory** — per-process in-memory counters (no coordination)
 *
 * Edge-safe factory: `createEdgeRateLimiter()` only allows upstash/memory —
 * no Node TCP imports.
 */

// ── Contract ────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>
}

// ── In-memory adapter ───────────────────────────────────

export class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number = 60_000
  ) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now()
    const entry = this.store.get(identifier)
    const reset = now + this.windowMs

    if (!entry || now > entry.resetAt) {
      this.store.set(identifier, { count: 1, resetAt: reset })
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset,
      }
    }

    entry.count += 1
    return {
      success: entry.count <= this.maxRequests,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - entry.count),
      reset: entry.resetAt,
    }
  }
}

// ── Upstash adapter (edge-safe) ─────────────────────────

export class UpstashRateLimiter implements RateLimiter {
  private inner: import('@upstash/ratelimit').Ratelimit

  constructor(opts: {
    url: string
    token: string
    maxRequests: number
    windowSeconds: number
    prefix: string
  }) {
    // Lazy require keeps this file importable from edge — the SDK itself is
    // edge-compatible.
    const { Ratelimit } = require('@upstash/ratelimit') as typeof import('@upstash/ratelimit')
    const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis')
    this.inner = new Ratelimit({
      redis: new Redis({ url: opts.url, token: opts.token }),
      limiter: Ratelimit.slidingWindow(opts.maxRequests, `${opts.windowSeconds} s`),
      prefix: opts.prefix,
    })
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const r = await this.inner.limit(identifier)
    return {
      success: r.success,
      limit: r.limit,
      remaining: r.remaining,
      reset: r.reset,
    }
  }
}

// ── Factory ─────────────────────────────────────────────

export interface RateLimiterConfig {
  maxRequests: number
  windowSeconds?: number
  prefix: string
}

/**
 * Create an edge-safe rate limiter (upstash or memory).
 *
 * Used from `proxy.ts` and any edge middleware. Never imports Node TCP Redis.
 */
export function createEdgeRateLimiter(
  config: RateLimiterConfig,
  upstash?: { url: string; token: string }
): RateLimiter {
  if (upstash?.url && upstash?.token) {
    return new UpstashRateLimiter({
      url: upstash.url,
      token: upstash.token,
      maxRequests: config.maxRequests,
      windowSeconds: config.windowSeconds ?? 60,
      prefix: config.prefix,
    })
  }
  return new InMemoryRateLimiter(
    config.maxRequests,
    (config.windowSeconds ?? 60) * 1000
  )
}
