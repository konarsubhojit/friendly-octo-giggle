import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CLAIM_HOLDER_MAX_DURATION_SECONDS,
  STALE_PROCESSING_CLAIM_MS,
} from '@/lib/db-queries'

/**
 * The stale-claim window has to sit inside a hard band. Outside it, a checkout
 * request can be stranded in `PROCESSING` forever (window too long) or have a
 * live worker's claim stolen mid-flight (window too short), so it is asserted
 * against the real deployment config rather than trusted to review.
 */
describe('checkout claim window', () => {
  const vercelConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')
  ) as {
    functions: Record<
      string,
      {
        maxDuration: number
        experimentalTriggers?: { retryAfterSeconds?: number }[]
      }
    >
  }

  const consumer =
    vercelConfig.functions['src/app/api/queue/checkout-orders/route.ts']

  it('outlives the longest possible claim holder', () => {
    expect(STALE_PROCESSING_CLAIM_MS).toBeGreaterThan(
      CLAIM_HOLDER_MAX_DURATION_SECONDS * 1000
    )
    expect(consumer.maxDuration).toBeLessThanOrEqual(
      CLAIM_HOLDER_MAX_DURATION_SECONDS
    )
  })

  it('expires before the queue redelivers, so a killed worker can be reclaimed', () => {
    const retryAfterSeconds = consumer.experimentalTriggers?.[0]?.retryAfterSeconds

    expect(retryAfterSeconds).toBeGreaterThan(0)
    expect(STALE_PROCESSING_CLAIM_MS).toBeLessThan(
      (retryAfterSeconds as number) * 1000
    )
  })
})
