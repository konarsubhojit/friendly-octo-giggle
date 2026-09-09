import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Captures the SQL the affinity collectors actually emit.
 *
 * These queries are only ever executed by a nightly Inngest cron, so a
 * regression in how they are built does not surface until 04:00 in production —
 * which is exactly how the `Connection terminated unexpectedly` incident
 * reached users. Asserting on the generated SQL is what makes that class of
 * defect fail here instead.
 *
 * The Drizzle builder is real; only the driver is faked, so these assertions
 * exercise genuine SQL generation rather than a mock's call log.
 */
const { capturedSql, fakeClient } = vi.hoisted(() => {
  const capturedSql: string[] = []
  const fakeClient = {
    query: (config: unknown) => {
      const text =
        typeof config === 'string'
          ? config
          : ((config as { text?: string }).text ?? '')
      capturedSql.push(text)
      return Promise.resolve({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })
    },
  }
  return { capturedSql, fakeClient }
})

vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const schema = await import('@/lib/schema')
  const db = drizzle(fakeClient as never, { schema })
  return { drizzleDb: db, primaryDrizzleDb: db, readDrizzleDb: db }
})

const {
  collectPurchasePairs,
  collectSharePairs,
  collectWishlistPairs,
} = await import('@/features/recommendations/services/scoring')

const windowStart = new Date('2026-01-01T00:00:00.000Z')

/** Number of non-overlapping matches, used to count join operands. */
const occurrences = (haystack: string, needle: RegExp): number =>
  haystack.match(needle)?.length ?? 0

describe('affinity collector SQL', () => {
  beforeEach(() => {
    capturedSql.length = 0
  })

  describe('collectPurchasePairs', () => {
    it('joins two deduplicated baskets rather than the raw order items', async () => {
      await collectPurchasePairs(windowStart)
      const [sql] = capturedSql

      // Both operands must be deduplicated. Joining raw OrderItem rows
      // multiplies by (variants of A) x (variants of B) per order, which is the
      // blow-up that outlived the connection.
      expect(occurrences(sql, /select distinct/gi)).toBe(2)
      expect(sql).toContain('"basket"')
      expect(sql).toContain('"partner"')
    })

    it('counts rows directly, which the deduplication makes equivalent', async () => {
      await collectPurchasePairs(windowStart)
      const [sql] = capturedSql

      expect(sql).not.toMatch(/count\(distinct/i)
      expect(sql).toMatch(/count\(\*\)/)
    })

    it('qualifies both sides of the join predicate', async () => {
      await collectPurchasePairs(windowStart)
      const [sql] = capturedSql

      expect(sql).toContain('"partner"."orderId" = "basket"."orderId"')
      expect(sql).toContain('"partner"."productId" <> "basket"."productId"')
    })

    it('keeps the support floor and the cancelled-order exclusion in the database', async () => {
      await collectPurchasePairs(windowStart)
      const [sql] = capturedSql

      // The HAVING floor is the privacy guarantee: a pair backed by too few
      // orders must never leave the database, regardless of the reader.
      expect(sql).toMatch(/having count\(\*\) >=/i)
      expect(sql).toMatch(/"status" <>/i)
      expect(sql).toMatch(/"createdAt" >=/i)
    })
  })

  describe('collectWishlistPairs', () => {
    it('joins two deduplicated projections and counts rows', async () => {
      await collectWishlistPairs(windowStart)
      const [sql] = capturedSql

      expect(occurrences(sql, /select distinct/gi)).toBe(2)
      expect(sql).not.toMatch(/count\(distinct/i)
      expect(sql).toContain('"partner"."userId" = "liked"."userId"')
      expect(sql).toContain('"partner"."productId" <> "liked"."productId"')
    })
  })

  describe('collectSharePairs', () => {
    it('joins two deduplicated day buckets', async () => {
      await collectSharePairs(windowStart)
      const [sql] = capturedSql

      expect(occurrences(sql, /select distinct/gi)).toBe(2)
      expect(sql).not.toMatch(/count\(distinct/i)
    })

    it('qualifies the day-bucket predicate on both sides', async () => {
      await collectSharePairs(windowStart)
      const [sql] = capturedSql

      // Drizzle renders a subquery's `sql`-aliased column unqualified, so the
      // natural `eq(partner.dayBucket, bucket.dayBucket)` silently produces
      // `"dayBucket" = "dayBucket"` — ambiguous, and rejected by PostgreSQL
      // only at execution time inside the cron.
      expect(sql).toContain('"partner"."dayBucket" = "bucket"."dayBucket"')
      expect(sql).not.toMatch(/(?<!\.)"dayBucket" = "dayBucket"/)
    })

    it('buckets by day in the projection instead of inside the join predicate', async () => {
      await collectSharePairs(windowStart)
      const [sql] = capturedSql

      // date_trunc in a join predicate is unsargable; as a projection the
      // planner can hash it.
      expect(sql).toMatch(/select distinct date_trunc\('day'/i)
    })
  })
})
