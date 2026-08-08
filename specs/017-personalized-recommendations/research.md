# Phase 0 Research: Personalized Recommendations

All `NEEDS CLARIFICATION` items from the Technical Context are resolved below.
Every decision is anchored to a verified fact about the current codebase.

---

## R-001 — Where do affinity scores live?

**Decision**: A new PostgreSQL table `ProductAffinityScore`, written by the
scoring job and read through Redis.

**Rationale**: Scores must survive Redis eviction, must be queryable by anchor
with an index, and must be recomputable and diffable. Redis alone would make
the job's output ephemeral and would break FR-005's requirement that the
fallback trigger only when scores are genuinely unavailable — with Redis-only
storage, every eviction would look like "no scores". The table is the source
of truth; Redis is the read cache in front of it, which is exactly the
`db.products.findBestsellers` pattern already in `src/lib/db-queries.ts`.

**Alternatives considered**:

- _Redis-only_ — rejected: no durability, no index, no admin "last refreshed"
  answer for FR-014.
- _Materialized view_ — rejected: raw SQL outside a Drizzle migration is
  prohibited by Constitution Principle II, and refresh scheduling would sit
  outside Inngest.
- _Computed on read_ — rejected: an aggregation over `OrderItem` per page view
  cannot meet the p95 target and would regress LCP (SC-005).

---

## R-002 — What signals feed the score, and with what weights?

**Decision**: Three server-side signals, weighted, combined into a single
directed strength value.

| Signal                 | Source table                     | Weight | Why                                                                |
| ---------------------- | -------------------------------- | ------ | ------------------------------------------------------------------ |
| Order co-purchase      | `OrderItem` joined via `orderId` | 1.0    | Strongest revealed preference — money changed hands                |
| Wishlist co-occurrence | `Wishlist` grouped by `userId`   | 0.5    | Explicit intent, but unconverted                                   |
| Share co-occurrence    | `ProductShare` grouped by day    | 0.25   | Weak intent; `ProductShare` has no `userId`, so grouping is coarse |

**Rationale**: The weights are ordinal, not tuned — they encode "a purchase
beats a wishlist beats a share", which is defensible without any A/B data.
Reviews and `ReviewVote` are deliberately excluded: a review is per-product
sentiment, not an association between two products, so it cannot produce a
directed pair.

**Verified constraint**: `ProductShare` (`src/lib/schema.ts`) has columns
`key`, `productId`, `variantId`, `createdAt` and **no** `userId`. Share
co-occurrence therefore has no per-user grouping key; day-bucketing is the
only available proxy, which is why it carries the lowest weight.

**Alternatives considered**:

- _Learned weights_ — rejected: explicitly out of scope in the spec.
- _Lift / PMI instead of weighted counts_ — deferred. Recorded as a follow-up:
  the schema stores both `score` and `support`, so a normalization change is a
  job-only change, not a migration.

---

## R-003 — What prevents an association from leaking one customer's basket?

**Decision**: `MIN_SUPPORT = 3` distinct orders (or distinct users, for
wishlist pairs), enforced in the aggregation `HAVING` clause so sub-threshold
pairs are never written to the table at all.

**Rationale**: The spec's edge case is explicit — a pair derived from a single
order is both statistically meaningless and a privacy leak, because a shopper
who bought an unusual product could infer the rest of another shopper's order
from the rail. Filtering at write time rather than read time means the leak is
impossible even if a reader is later written incorrectly.

**Alternatives considered**:

- _Filter on read_ — rejected: leaves the sensitive data in the table.
- _Differential privacy noise_ — rejected: disproportionate for a threshold
  problem, and it would corrupt the ordering the rails depend on.

---

## R-004 — Redis `getCachedData` or a `"use cache"` scope?

**Decision**: Redis `getCachedData` exclusively. No recommendation read is
ever wrapped in a `"use cache"` scope.

**Rationale**: FR-004 mandates `getCachedData` with stampede prevention.
Constitution Principle IV states that "a Redis read MUST NOT be nested inside
a `"use cache"` scope — the two layers are alternatives, never stacked."
Choosing Redis for every surface resolves the tension with one rule instead of
per-surface reasoning, and it is the correct layer regardless: the cart and
personalized rails read session-scoped state, which a `"use cache"` scope is
forbidden from touching.

**Consequence**: Every rail is a per-request server render inside a `Suspense`
boundary. This satisfies FR-011 by construction and keeps the rails off the
prerendered shell, so they cannot regress LCP (SC-005).

**Alternatives considered**:

- _`"use cache"` for the anonymous product-page rail, Redis for the rest_ —
  rejected: two caching models for one feature, two invalidation paths, and a
  contradiction with FR-004 for no measurable gain.

---

## R-005 — How is the job bounded so it cannot exhaust the timeout?

**Decision**: Three independent bounds.

1. **Time window** — only orders with `createdAt >= now() - 180 days` are
   scanned. Older behaviour is stale for a seasonal catalog anyway.
2. **Anchor batching** — anchors are processed in batches inside separate
   `step.run` calls, so each Inngest step stays small and is independently
   memoized and retried.
3. **Fan-out cap** — at most `MAX_PAIRS_PER_ANCHOR = 24` rows are retained per
   anchor, ordered by score. A rail shows at most 8; 24 leaves headroom for
   candidate filtering (out-of-stock, soft-deleted, cart exclusion) without a
   second query.

**Rationale**: This mirrors `scanAbandonedCartsFunction`, the existing cron
function that already sweeps a growing table. Using `step.run` per batch means
a mid-job failure resumes rather than restarting, which is what makes FR-002's
"safe to re-run" requirement achievable.

**Idempotency**: The write is a delete-then-insert per anchor batch inside a
transaction, so a re-run converges to the same rows rather than accumulating
duplicates. `(anchorProductId, recommendedProductId)` is unique, so a partial
retry cannot double-insert.

---

## R-006 — Recently-viewed is `localStorage`-only. How does it become a signal?

**Decision**: Recently-viewed is used as a **client-supplied anchor seed** for
the personalized rail, not as an input to the scoring job.

**Rationale**: `useRecentlyViewed` in
`src/features/product/hooks/useRecentlyViewed.ts` stores up to 12 entries
under the `kiyon_recently_viewed` key in `localStorage`. There is no
server-side view table. Creating one to feed the scoring job would (a) add
per-user browsing storage the spec never asked for, (b) risk persisting a
guest profile in violation of FR-009, and (c) violate Principle VII for a
signal that is weaker than the three already available.

Instead, `PersonalizedRailSeeds` (a Client Component) reads those IDs and
calls `GET /api/recommendations/personalized?seeds=…`. The route unions the
seeds with the signed-in shopper's own order and wishlist anchors, fetches
scores for that anchor set, and merges the results. Guests receive the
bestseller path without the seeds ever being stored.

**FR-001 coverage**: satisfied — recently-viewed influences what a shopper
sees; it simply influences it at selection time rather than at scoring time.
Recorded here as an intentional, documented interpretation.

**Alternatives considered**:

- _New `ProductViewEvent` table_ — rejected for the three reasons above.
- _Ignore recently-viewed entirely_ — rejected: the spec names it explicitly.

**Spec reconciliation**: FR-001 was amended to list only the three server-side
scoring signals, and a new FR-001a records recently-viewed as a selection-time
seed. The spec and this decision no longer disagree.

---

## R-007 — Where are impressions and clicks recorded?

**Decision**: `logBusinessEvent` via a new `POST /api/recommendations/event`
route. **No new table.**

**Rationale**: FR-012 says "reusing the existing search click-analytics
approach". That approach, verified at `src/app/api/search/click/route.ts`, is
a Zod-validated POST that calls `logBusinessEvent` with event type
`search_result_click` and no persistence layer. Mirroring it gives FR-012 and
SC-007 without introducing storage the spec does not require (Principle VII).

The spec's `RecommendationEvent` key entity is therefore modelled as a
**structured log event**, not a table. This is called out in
[data-model.md](./data-model.md) so the omission is deliberate and visible.

**Spec reconciliation**: SC-007 was amended to state that click-through rate
is derived by aggregating `recommendation_impression` against
`recommendation_click` in the log platform, and in-application CTR reporting
was added to Out of Scope. Without that amendment SC-007 would have been
untestable against a system that persists no events.

**Client transport**: `navigator.sendBeacon` with a `fetch` fallback, the
pattern already used in `src/features/product/components/ProductGrid.tsx`.

---

## R-008 — What makes a candidate ineligible?

**Decision**: One shared predicate in `services/selection.ts`, applied to
every surface.

A candidate is excluded when any of the following holds:

- `products.deletedAt IS NOT NULL` (soft-deleted)
- no variant has `stock - reservedStock > 0` (no sellable stock)
- it is the anchor product
- it is already in the requesting shopper's cart (cart surface only)
- it is already present earlier in the same result list (dedupe across anchors)

**Verified constraint**: `products` has **no `published` column** — the schema
uses `deletedAt IS NULL` as the active-product filter throughout
`src/lib/db-queries.ts`. FR-006 was amended to drop "unpublished" and name
soft-delete as the sole inactive-product marker; there is no separate
publication state to honour. This is the same mapping the rest of the
codebase already makes.

**Stock privacy (FR-010, SC-003)**: the selection service MUST NOT return
`ProductGridItem`. That type — verified at
`src/features/product/components/ProductGrid.tsx` — is
`Pick<Product, 'id' | 'name' | 'description' | 'image' | 'category'> &
{ price: number; stock: number; soldCount: number }`. It carries a **numeric
stock count** and a sales-volume count, so serializing it would violate FR-010
directly.

Recommendations return a narrower `RecommendationItem`:

```ts
export type RecommendationItem = Pick<
  Product,
  'id' | 'name' | 'description' | 'image' | 'category'
> & {
  price: number
  inStock: boolean
}
```

Stock is read for the eligibility predicate, collapsed to a boolean, and the
numeric value is discarded before the object leaves the service. `soldCount`
is dropped entirely — it is a sales-volume disclosure with no rail purpose.

**Consequence for rendering**: `RecommendationRail` cannot reuse
`BestsellersScroller`, whose props require `ProductGridItem`. It renders its
own card and expresses availability through `StockBadge`'s boolean mode.

**Consequence for the fallback**: `db.products.findBestsellers` returns
`Product[]`. The fallback path MUST map through the same
`toRecommendationItem` projection, otherwise the branch that SC-002 exercises
would leak exactly the fields the scored path strips.

---

## R-009 — What is the fallback, exactly?

**Decision**: `db.products.findBestsellers({ withCache: true })`, scoped to
the anchor's category when a category is known, unscoped otherwise.

**Rationale**: Bestsellers is already the platform's cold-start answer, is
already Redis-cached with a stale window
(`CACHE_TTL.PRODUCTS_BESTSELLERS` = 600s / stale 60s), and already has a
render component (`BestsellersScroller`). Reusing it means FR-005 costs one
function call rather than a parallel implementation.

**Trigger conditions** — the fallback fires when _any_ of these is true:

1. the anchor has no rows in `ProductAffinityScore`
2. every scored candidate was filtered out by R-008
3. the Redis read threw, or the DB read behind it threw

Condition 3 is what makes SC-002 hold with Redis down: `getCachedData`
failures are caught in the selection service and treated as "no scores".

**Category scoping**: `products.category` is a plain `text` column with an
index, so a category-scoped bestseller query needs no schema change.

---

## R-010 — How does an admin trigger a recomputation?

**Decision**: `POST /api/admin/recommendations/recompute` publishes the same
Inngest event the cron trigger fires; the function carries both triggers.

**Rationale**: A single function with two triggers means the manual path and
the scheduled path cannot diverge. Publishing goes through
`src/lib/inngest/dispatch.ts`, the single seam every workflow already uses,
so timeout and fallback behaviour is inherited rather than reimplemented.

**Permission**: `checkAdminAuth('system:manage')` for the routes and
`requireAdminPermission('system:manage', '/admin/recommendations')` for the
page — the same permission that already guards the email-failures admin
surface, which is the closest existing analogue (an operational job dashboard,
not a merchandising tool). The path must also be registered in the admin
route-permission map in `src/proxy.ts`, which is the edge gate; the in-page
check alone is not sufficient.

**Last-refresh answer (FR-014)**: `MAX(computedAt)` from
`ProductAffinityScore`, plus a row count. No separate metadata table.

---

## R-011 — Which page is the landing page?

**Decision**: `/shop` — `src/app/(public)/shop/page.tsx`.

**Rationale**: `src/app/(public)/page.tsx` redirects to `/shop`, so `/shop` is
the effective landing page and is already where `BestsellersScroller` renders.
Placing the personalized rail there puts it beside the existing non-personalized
rail, which is also where the guest variant of Story 3 must appear.

**Spec reconciliation**: FR-007 and Story 3 were amended to say "`/shop`
landing page" rather than "home page".

**Zero-result recovery (Story 4)** also lives in this file, since the shop page
owns the search results and its own empty state. Both changes are additive
`Suspense` boundaries in one route file.

---

## Open follow-ups (non-blocking)

- Normalization from weighted counts to lift/PMI is a job-only change; the
  schema already stores `support` alongside `score` to make it possible.
- If share attribution later gains a `userId`, the share signal can move from
  day-bucketed to per-user grouping and its weight can be raised.
