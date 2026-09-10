import { and, eq, gte, inArray, ne, sql } from 'drizzle-orm'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import { withDatabaseRetry } from '@/lib/db/retry'
import {
  orderItems,
  orders,
  productAffinityScores,
  productShares,
  wishlists,
} from '@/lib/schema'
import { generateShortId } from '@/lib/short-id'
import {
  AFFINITY_WINDOW_DAYS,
  ANCHOR_BATCH_SIZE,
  MAX_PAIRS_PER_ANCHOR,
  MIN_SUPPORT,
  SIGNAL_WEIGHTS,
  type SignalSource,
} from '@/features/recommendations/constants'

/**
 * One directed co-occurrence, before weighting.
 *
 * `support` is the number of distinct grouping keys (orders for purchases,
 * users for wishlists, day buckets for shares) that produced the pair.
 */
export interface SignalPair {
  readonly anchorProductId: string
  readonly recommendedProductId: string
  readonly support: number
}

/** A merged, weighted association ready to be written. */
export interface ScoredPair {
  readonly anchorProductId: string
  readonly recommendedProductId: string
  readonly score: number
  readonly support: number
  readonly source: SignalSource | 'combined'
}

/**
 * Resolve the inclusive lower bound of the history window.
 *
 * Computed once per run and threaded through every collector so an Inngest
 * retry reproduces exactly the same rows. Recomputing `now()` per step would
 * let the boundary drift between attempts and break re-run determinism.
 */
export const resolveWindowStart = (
  windowDays: number = AFFINITY_WINDOW_DAYS,
  now: Date = new Date()
): Date => new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)

/**
 * Directed pairs from products bought in the same order.
 *
 * The self-join is on `orderId` with a `<>` on the product pair, so each
 * ordered pair (A→B and B→A) is emitted independently. Cancelled orders are
 * excluded: a reversed purchase is not evidence of affinity.
 *
 * `OrderItem` carries one row per *variant*, so a single order can list the
 * same `productId` several times. The join operand is therefore the distinct
 * `(orderId, productId)` basket rather than the raw rows: without that
 * projection the self-join multiplies by (variants of A) x (variants of B) per
 * order, and the intermediate result grows super-linearly with catalog depth
 * until the statement outlives its connection. Deduplicating first leaves the
 * result unchanged — `count(distinct orderId)` cannot see the duplicates it
 * removes — while letting the planner hash-aggregate a plain `count(*)`
 * instead of sorting every group for a `count(distinct)`.
 *
 * The `HAVING` floor runs in the database so a pair backed by fewer than
 * {@link MIN_SUPPORT} distinct orders never leaves it. Filtering here rather
 * than in the reader is what makes the privacy guarantee hold even if a future
 * reader forgets to check.
 */
export const collectPurchasePairs = async (
  windowStart: Date
): Promise<SignalPair[]> => {
  // The same projection twice under different names: PostgreSQL needs two
  // distinct aliases to self-join a derived table, and re-deriving it costs a
  // second aggregate over an already-filtered range rather than a second pass
  // over the quadratic join.
  const basketFor = (name: 'basket' | 'partner') =>
    drizzleDb
      .selectDistinct({
        orderId: orderItems.orderId,
        productId: orderItems.productId,
      })
      .from(orderItems)
      .innerJoin(
        orders,
        and(
          eq(orders.id, orderItems.orderId),
          ne(orders.status, 'CANCELLED'),
          gte(orders.createdAt, windowStart)
        )
      )
      .as(name)

  const basket = basketFor('basket')
  const partner = basketFor('partner')

  const rows = await withDatabaseRetry(
    () =>
      drizzleDb
        .select({
          anchorProductId: basket.productId,
          recommendedProductId: partner.productId,
          support: sql<number>`cast(count(*) as int)`,
        })
        .from(basket)
        .innerJoin(
          partner,
          and(
            eq(partner.orderId, basket.orderId),
            ne(partner.productId, basket.productId)
          )
        )
        .groupBy(basket.productId, partner.productId)
        .having(sql`count(*) >= ${MIN_SUPPORT}`),
    { context: 'affinity_purchase_pairs' }
  )

  return rows.map((row) => ({
    anchorProductId: row.anchorProductId,
    recommendedProductId: row.recommendedProductId,
    support: Number(row.support),
  }))
}

/**
 * Directed pairs from products wishlisted by the same shopper.
 *
 * Grouped by `userId`, so support counts distinct shoppers. Weaker than a
 * purchase because the intent never converted.
 *
 * `UNIQUE (userId, productId)` already makes each side of the join one row per
 * shopper per product, so the distinct projection removes nothing here. It is
 * kept for symmetry with the other two collectors and because it turns
 * `count(distinct userId)` into `count(*)`, which the planner can satisfy with
 * a hash aggregate instead of sorting every group.
 */
export const collectWishlistPairs = async (
  windowStart: Date
): Promise<SignalPair[]> => {
  const likedFor = (name: 'liked' | 'partner') =>
    drizzleDb
      .selectDistinct({
        userId: wishlists.userId,
        productId: wishlists.productId,
      })
      .from(wishlists)
      .where(gte(wishlists.createdAt, windowStart))
      .as(name)

  const liked = likedFor('liked')
  const partner = likedFor('partner')

  const rows = await withDatabaseRetry(
    () =>
      drizzleDb
        .select({
          anchorProductId: liked.productId,
          recommendedProductId: partner.productId,
          support: sql<number>`cast(count(*) as int)`,
        })
        .from(liked)
        .innerJoin(
          partner,
          and(
            eq(partner.userId, liked.userId),
            ne(partner.productId, liked.productId)
          )
        )
        .groupBy(liked.productId, partner.productId)
        .having(sql`count(*) >= ${MIN_SUPPORT}`),
    { context: 'affinity_wishlist_pairs' }
  )

  return rows.map((row) => ({
    anchorProductId: row.anchorProductId,
    recommendedProductId: row.recommendedProductId,
    support: Number(row.support),
  }))
}

/**
 * Directed pairs from products shared on the same day.
 *
 * `ProductShare` carries no `userId`, so there is no per-shopper grouping key
 * available. Day bucketing is the only proxy, which is precisely why this
 * signal carries the lowest weight in {@link SIGNAL_WEIGHTS}.
 *
 * Nothing constrains how many times one product may be shared in a day, so
 * joining the raw rows multiplies by (shares of A that day) x (shares of B
 * that day) — the worst blow-up of the three collectors, and one that grows
 * with traffic rather than with catalog size. Joining the distinct
 * `(day, productId)` buckets instead collapses that to one row per product per
 * day and leaves `support` unchanged, because it was already counting distinct
 * days. It also moves `date_trunc` out of the join predicate, where no index
 * can reach it, and into a projection the planner can hash.
 */
export const collectSharePairs = async (
  windowStart: Date
): Promise<SignalPair[]> => {
  const bucketFor = (name: 'bucket' | 'partner') =>
    drizzleDb
      .selectDistinct({
        dayBucket: sql<Date>`date_trunc('day', ${productShares.createdAt})`.as(
          'dayBucket'
        ),
        productId: productShares.productId,
      })
      .from(productShares)
      .where(gte(productShares.createdAt, windowStart))
      .as(name)

  const bucket = bucketFor('bucket')
  const partner = bucketFor('partner')

  const rows = await withDatabaseRetry(
    () =>
      drizzleDb
        .select({
          anchorProductId: bucket.productId,
          recommendedProductId: partner.productId,
          support: sql<number>`cast(count(*) as int)`,
        })
        .from(bucket)
        .innerJoin(
          partner,
          and(
            // Drizzle renders a subquery's `sql`-aliased column unqualified,
            // so `eq(partner.dayBucket, bucket.dayBucket)` would emit an
            // ambiguous `"dayBucket" = "dayBucket"`. The alias names are
            // literals of this function, so name them explicitly.
            sql`"partner"."dayBucket" = "bucket"."dayBucket"`,
            ne(partner.productId, bucket.productId)
          )
        )
        .groupBy(bucket.productId, partner.productId)
        .having(sql`count(*) >= ${MIN_SUPPORT}`),
    { context: 'affinity_share_pairs' }
  )

  return rows.map((row) => ({
    anchorProductId: row.anchorProductId,
    recommendedProductId: row.recommendedProductId,
    support: Number(row.support),
  }))
}

const pairKey = (anchor: string, recommended: string): string =>
  `${anchor}\u0000${recommended}`

interface Accumulator {
  anchorProductId: string
  recommendedProductId: string
  score: number
  support: number
  dominantSource: SignalSource
  dominantContribution: number
  sourceCount: number
}

/**
 * Combine the three signal sets into one weighted, directed score per pair.
 *
 * `support` takes the maximum rather than the sum: the signals count different
 * things (orders, users, days), so adding them would produce a number that
 * means nothing. The maximum preserves "at least this many independent
 * observations back this pair", which is what the threshold guarantee needs.
 *
 * `source` records the single strongest contributor, or `combined` when more
 * than one signal contributed, so the admin surface can explain a pair.
 */
export const mergeSignals = (
  signals: Readonly<Record<SignalSource, readonly SignalPair[]>>
): ScoredPair[] => {
  const merged = new Map<string, Accumulator>()

  for (const source of Object.keys(SIGNAL_WEIGHTS) as SignalSource[]) {
    const weight = SIGNAL_WEIGHTS[source]

    for (const pair of signals[source] ?? []) {
      if (pair.anchorProductId === pair.recommendedProductId) continue

      const contribution = pair.support * weight
      const key = pairKey(pair.anchorProductId, pair.recommendedProductId)
      const existing = merged.get(key)

      if (!existing) {
        merged.set(key, {
          anchorProductId: pair.anchorProductId,
          recommendedProductId: pair.recommendedProductId,
          score: contribution,
          support: pair.support,
          dominantSource: source,
          dominantContribution: contribution,
          sourceCount: 1,
        })
        continue
      }

      existing.score += contribution
      existing.support = Math.max(existing.support, pair.support)
      existing.sourceCount += 1
      if (contribution > existing.dominantContribution) {
        existing.dominantSource = source
        existing.dominantContribution = contribution
      }
    }
  }

  return [...merged.values()].map((entry) => ({
    anchorProductId: entry.anchorProductId,
    recommendedProductId: entry.recommendedProductId,
    score: entry.score,
    support: entry.support,
    source: entry.sourceCount > 1 ? 'combined' : entry.dominantSource,
  }))
}

/**
 * Group pairs by anchor and keep only the strongest
 * {@link MAX_PAIRS_PER_ANCHOR} for each.
 *
 * Ties break on `support` then on product id, so the truncation is
 * deterministic and a re-run produces byte-identical rows.
 */
export const truncateByAnchor = (
  pairs: readonly ScoredPair[]
): Map<string, ScoredPair[]> => {
  const byAnchor = new Map<string, ScoredPair[]>()

  for (const pair of pairs) {
    const list = byAnchor.get(pair.anchorProductId) ?? []
    list.push(pair)
    byAnchor.set(pair.anchorProductId, list)
  }

  for (const [anchor, list] of byAnchor) {
    list.sort(
      (a, b) =>
        b.score - a.score ||
        b.support - a.support ||
        a.recommendedProductId.localeCompare(b.recommendedProductId)
    )
    byAnchor.set(anchor, list.slice(0, MAX_PAIRS_PER_ANCHOR))
  }

  return byAnchor
}

/** Split anchors into batches so each Inngest step stays small. */
export const batchAnchors = (
  anchors: readonly string[],
  size: number = ANCHOR_BATCH_SIZE
): string[][] => {
  const batches: string[][] = []
  for (let i = 0; i < anchors.length; i += size) {
    batches.push(anchors.slice(i, i + size))
  }
  return batches
}

/**
 * Replace every score row for the given anchors, in one transaction.
 *
 * Delete-then-insert rather than upsert: an anchor whose associations
 * disappeared between runs must lose its stale rows, which an upsert would
 * leave behind. The unique constraint on `(anchorProductId,
 * recommendedProductId)` means a partial retry cannot double-insert.
 *
 * Uses the primary connection because the scoring job reads back what it wrote
 * on the next batch boundary.
 */
export const writeAffinityBatch = async (
  anchorIds: readonly string[],
  pairsByAnchor: ReadonlyMap<string, readonly ScoredPair[]>,
  computedAt: Date
): Promise<number> => {
  if (anchorIds.length === 0) return 0

  const rows = anchorIds.flatMap((anchorId) =>
    (pairsByAnchor.get(anchorId) ?? []).map((pair) => ({
      id: generateShortId(),
      anchorProductId: pair.anchorProductId,
      recommendedProductId: pair.recommendedProductId,
      score: pair.score,
      support: pair.support,
      source: pair.source,
      computedAt,
    }))
  )

  await primaryDrizzleDb.transaction(async (tx) => {
    await tx
      .delete(productAffinityScores)
      .where(inArray(productAffinityScores.anchorProductId, [...anchorIds]))

    if (rows.length > 0) {
      await tx.insert(productAffinityScores).values(rows)
    }
  })

  return rows.length
}
