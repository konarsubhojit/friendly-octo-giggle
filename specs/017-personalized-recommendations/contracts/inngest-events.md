# Contract: Inngest Events and Functions

Follows the pattern established by `refreshExchangeRatesFunction`
(`src/lib/inngest/functions/exchange-rates.ts`) and the feature-owned
placement used by `src/features/cart/inngest/`.

---

## Function — `computeProductAffinityFunction`

**File**: `src/features/recommendations/inngest/affinity.ts`
**Registered in**: `src/lib/inngest/registry.ts` (the single list
`/api/inngest` serves)

```ts
export const computeProductAffinityFunction = inngest.createFunction(
  {
    id: 'compute-product-affinity',
    name: 'Compute product affinity scores',
    triggers: [
      cron('0 4 * * *'),
      { event: 'recommendations/affinity.recompute' },
    ],
    concurrency: { limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    /* … */
  }
)
```

**Schedule**: `0 4 * * *` — 04:00 UTC daily. Chosen to sit after the existing
03:00 exchange-rate refresh so the two heavy nightly jobs do not overlap.

**Concurrency `1`**: two simultaneous runs would race on the delete-then-insert
per anchor batch. Serializing is correct and costs nothing for a daily job.

**Retries `2`**: matches the exchange-rate function. Each `step.run` is
independently memoized, so a retry resumes rather than restarting.

---

## Event — `recommendations/affinity.recompute`

Published by `POST /api/admin/recommendations/recompute` through
`publishWithTimeout` from `src/lib/inngest/dispatch.ts`.

```ts
{
  name: 'recommendations/affinity.recompute',
  data: {
    windowDays?: number   // 7..365, overrides AFFINITY_WINDOW_DAYS for this run
    triggeredBy: string   // admin user id, for the audit trail in the log line
  }
}
```

When the function runs from the cron trigger, `event.data` is absent and the
constants are used.

---

## Step decomposition

Each step is a separate `step.run` so a failure resumes mid-job rather than
rescanning (R-005).

| Step id                  | Work                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolve-window`         | Compute the window start from `windowDays`; return it so retries reuse the same boundary                                                        |
| `collect-purchase-pairs` | Aggregate `OrderItem` pairs per `orderId` within the window, `HAVING COUNT(DISTINCT orderId) >= MIN_SUPPORT`                                    |
| `collect-wishlist-pairs` | Aggregate `Wishlist` pairs per `userId`, `HAVING COUNT(DISTINCT userId) >= MIN_SUPPORT`                                                         |
| `collect-share-pairs`    | Aggregate `ProductShare` pairs per day bucket, same support floor                                                                               |
| `write-batch-<n>`        | For each anchor batch of `ANCHOR_BATCH_SIZE`: delete existing rows for those anchors, insert the top `MAX_PAIRS_PER_ANCHOR`, in one transaction |
| `invalidate-cache`       | `invalidateCache('recommendations:*')`; failures logged, never thrown                                                                           |

A stable window boundary from the first step is what makes a retry produce the
same rows as the original attempt — without it, `now()` would drift between
attempts and violate FR-002's re-run safety.

---

## Outcome recording

```ts
await step.score('score-affinity-computed', {
  name: SCORE_NAMES.affinityComputed,
  value: true,
})

logBusinessEvent({
  event: 'recommendation_scores_computed',
  details: { windowDays, anchorCount, pairCount, durationMs, triggeredBy },
  success: true,
})
```

`SCORE_NAMES.affinityComputed` is a new entry in the existing score-name
constants consumed by the `scoreMiddleware` already installed on the Inngest
client.

---

## Return value

```ts
{
  computed: true,
  windowDays: number,
  anchorCount: number,
  pairCount: number,
}
```

Returned so the Inngest dashboard shows the run's effect without a log dive,
matching what `refreshExchangeRatesFunction` already does.

---

## Failure behaviour

- A failure in any `collect-*` step aborts the run before any write, so the
  previous scores remain intact and every surface keeps serving them. A failed
  run degrades to _stale scores_, never to _no scores_.
- A failure inside a `write-batch-<n>` step leaves earlier batches committed.
  That is acceptable and self-correcting: each batch is internally
  transactional, the unique constraint prevents duplicates, and the next run
  rewrites every anchor.
- Redis invalidation failure is logged and does not fail the run
  (Constitution Principle IV). Stale cache entries expire within
  `CACHE_TTL.RECOMMENDATIONS` (15 min) regardless.
