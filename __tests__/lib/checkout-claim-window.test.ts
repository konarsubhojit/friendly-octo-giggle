import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CLAIM_HOLDER_MAX_DURATION_SECONDS,
  STALE_PROCESSING_CLAIM_MS,
} from '@/lib/db-queries'

/**
 * The stale-claim window has to outlive every invocation that can hold a
 * `PROCESSING` claim. If it does not, a live claim holder can have its claim
 * stolen mid-flight and two workers race to create the same order.
 *
 * The route budgets are read from source rather than imported, because
 * importing either route pulls its whole dependency graph (auth, database)
 * into a test that only cares about one exported number.
 */
const declaredMaxDuration = (routePath: string): number => {
  const source = readFileSync(join(process.cwd(), routePath), 'utf8')
  const match = /export const maxDuration = (\d+)/.exec(source)

  if (!match) {
    throw new Error(`${routePath} does not declare a maxDuration`)
  }

  return Number(match[1])
}

describe('checkout claim window', () => {
  it('outlives the longest possible claim holder', () => {
    expect(STALE_PROCESSING_CLAIM_MS).toBeGreaterThan(
      CLAIM_HOLDER_MAX_DURATION_SECONDS * 1000
    )
  })

  it.each([
    // Runs every durable checkout step.
    ['src/app/api/inngest/route.ts'],
    // Runs the inline `waitUntil` fallback when the event cannot be published.
    ['src/app/api/orders/route.ts'],
  ])('caps %s at the claim-holder ceiling', (routePath) => {
    expect(declaredMaxDuration(routePath)).toBeLessThanOrEqual(
      CLAIM_HOLDER_MAX_DURATION_SECONDS
    )
  })
})
