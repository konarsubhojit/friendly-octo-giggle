import { cron } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { SCORE_NAMES } from '@/lib/inngest/scores'
import { logBusinessEvent, logError } from '@/lib/logger'
import { invalidateCache } from '@/lib/redis'
import { CACHE_KEYS } from '@/lib/cache'
import { AFFINITY_WINDOW_DAYS } from '@/features/recommendations/constants'
import {
  batchAnchors,
  collectPurchasePairs,
  collectSharePairs,
  collectWishlistPairs,
  mergeSignals,
  resolveWindowStart,
  truncateByAnchor,
  writeAffinityBatch,
  type ScoredPair,
} from '@/features/recommendations/services/scoring'

/** Event name shared by the admin trigger and this function's declaration. */
export const AFFINITY_RECOMPUTE_EVENT = 'recommendations/affinity.recompute'

/**
 * Two retries. A failed run is not urgent — the previous scores stay in place
 * and every surface keeps serving them — but a transient connection error
 * should not cost a whole day of freshness.
 */
export const AFFINITY_RETRIES = 2

/**
 * Recompute product affinity scores from purchase, wishlist and share signals.
 *
 * Carries both a nightly cron trigger and an event trigger so the scheduled
 * path and the admin "recompute now" path execute exactly the same code; two
 * separate entry points would eventually diverge.
 *
 * Runs at 04:00 UTC, after the 03:00 exchange-rate refresh, so the two heavy
 * nightly jobs do not contend.
 *
 * Concurrency is pinned to one: two simultaneous runs would race on the
 * delete-then-insert per anchor batch. Serialising costs nothing for a job
 * that runs once a day.
 */
export const computeProductAffinityFunction = inngest.createFunction(
  {
    id: 'compute-product-affinity',
    name: 'Compute product affinity scores',
    triggers: [cron('0 4 * * *'), { event: AFFINITY_RECOMPUTE_EVENT }],
    concurrency: { limit: 1 },
    retries: AFFINITY_RETRIES,
  },
  async ({ event, step }) => {
    const startedAt = Date.now()
    // The cron trigger and the admin event trigger carry different payload
    // shapes, so the union has no shared members; read them as unknown values.
    const eventData = (event?.data ?? {}) as Record<string, unknown>
    const windowDays =
      typeof eventData.windowDays === 'number'
        ? eventData.windowDays
        : AFFINITY_WINDOW_DAYS
    const triggeredBy =
      typeof eventData.triggeredBy === 'string' ? eventData.triggeredBy : 'cron'

    // Resolved once and memoized by the step, so a retry reuses the same
    // boundary. Recomputing `now()` per attempt would let the window drift and
    // make a re-run produce different rows.
    const windowStartIso = await step.run('resolve-window', () =>
      Promise.resolve(resolveWindowStart(windowDays).toISOString())
    )
    const windowStart = new Date(windowStartIso)

    const purchase = await step.run('collect-purchase-pairs', () =>
      collectPurchasePairs(windowStart)
    )
    const wishlist = await step.run('collect-wishlist-pairs', () =>
      collectWishlistPairs(windowStart)
    )
    const share = await step.run('collect-share-pairs', () =>
      collectSharePairs(windowStart)
    )

    const merged = mergeSignals({ purchase, wishlist, share })
    const byAnchor = truncateByAnchor(merged)
    const anchors = [...byAnchor.keys()].sort((a, b) => a.localeCompare(b))
    const batches = batchAnchors(anchors)

    // A single timestamp for the whole run, so `MAX(computedAt)` answers "when
    // did the last run finish" rather than "when did the last batch finish".
    const computedAt = new Date()

    let pairCount = 0
    for (const [index, batch] of batches.entries()) {
      const written = await step.run(`write-batch-${index}`, () =>
        writeAffinityBatch(
          batch,
          byAnchor as ReadonlyMap<string, readonly ScoredPair[]>,
          computedAt
        )
      )
      pairCount += written
    }

    await step.run('invalidate-cache', async () => {
      try {
        await invalidateCache(CACHE_KEYS.RECOMMENDATIONS_PATTERN)
      } catch (error) {
        // Cache invalidation is best effort: stale entries expire inside
        // CACHE_TTL.RECOMMENDATIONS anyway, and failing the run here would
        // discard scores that were written successfully.
        logError({ error, context: 'affinity_cache_invalidation' })
      }
      return null
    })

    await step.score('score-affinity-computed', {
      name: SCORE_NAMES.affinityComputed,
      value: pairCount > 0,
    })

    logBusinessEvent({
      event: 'recommendation_scores_computed',
      details: {
        windowDays,
        anchorCount: anchors.length,
        pairCount,
        durationMs: Date.now() - startedAt,
        triggeredBy,
      },
      success: true,
    })

    return {
      computed: true,
      windowDays,
      anchorCount: anchors.length,
      pairCount,
    }
  }
)
