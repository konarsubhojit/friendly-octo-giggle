/**
 * In-memory rate limiter — per-process, no coordination.
 *
 * Edge-safe. Used as fallback when no distributed backend is available.
 */

import type { RateLimiter, RateLimitResult } from './types'

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
