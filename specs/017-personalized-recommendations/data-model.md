# Phase 1 Data Model: Personalized Recommendations

Source of truth for the schema change. Column types follow the conventions
verified in `src/lib/schema.ts`: `varchar(7)` Base62 short IDs from
`src/lib/short-id.ts`, `timestamp` with `defaultNow()`, and index declarations
in the table's second callback argument.

---

## New table — `ProductAffinityScore`

A directed association from an anchor product to a recommended product.
Directed, not symmetric: "shoppers who bought A also bought B" does not carry
the same strength as the reverse when A is a staple and B is an add-on.

| Column                 | Type              | Null | Default        | Notes                                                                           |
| ---------------------- | ----------------- | ---- | -------------- | ------------------------------------------------------------------------------- |
| `id`                   | `varchar(7)`      | no   | —              | PK, `generateShortId()`                                                         |
| `anchorProductId`      | `varchar(7)`      | no   | —              | FK → `Product.id`, `ON DELETE CASCADE`                                          |
| `recommendedProductId` | `varchar(7)`      | no   | —              | FK → `Product.id`, `ON DELETE CASCADE`                                          |
| `score`                | `doublePrecision` | no   | —              | Weighted association strength; higher is stronger                               |
| `support`              | `integer`         | no   | —              | Distinct orders/users backing the pair; `>= MIN_SUPPORT` by construction        |
| `source`               | `text`            | no   | `'combined'`   | Dominant contributing signal: `purchase` \| `wishlist` \| `share` \| `combined` |
| `computedAt`           | `timestamp`       | no   | `defaultNow()` | Set by the scoring run that wrote the row                                       |

### Constraints

- `PRIMARY KEY (id)`
- `UNIQUE (anchorProductId, recommendedProductId)` — one row per directed pair;
  makes the job's delete-then-insert retry-safe (R-005)
- `CHECK (anchorProductId <> recommendedProductId)` — a product can never
  recommend itself, enforced at the database rather than trusted to the reader
  (Story 1, scenario 4)
- `CHECK (support >= 1)` — the real floor is `MIN_SUPPORT`, enforced in the
  aggregation; the check guards against a malformed direct write

### Indexes

| Index                           | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `(anchorProductId, score DESC)` | The only hot read path: top-N by anchor. Covers FR-013.       |
| `(recommendedProductId)`        | Cascade-delete support and reverse lookups during job cleanup |
| `(computedAt)`                  | `MAX(computedAt)` for the admin last-refresh answer (FR-014)  |

### Cascade behaviour

Both FKs use `ON DELETE CASCADE`. Deleting a product removes every association
it participates in, which is what the spec's "deleting a user or product must
remove the associated signals" edge case requires on the product side. On the
user side there is nothing to delete: no row in this table references a user.

---

## Modified tables

**None.** `Product`, `OrderItem`, `Wishlist`, and `ProductShare` are read-only
inputs to the scoring job. No column is added to any existing table.

---

## Deliberately not modelled as a table — `RecommendationEvent`

The spec's `RecommendationEvent` key entity is implemented as a **structured
log event** through `logBusinessEvent`, not as a database table. See
[research.md R-007](./research.md) for the rationale: FR-012 asks for parity
with the existing search click-analytics approach, and that approach persists
nothing. Recording this here so the absence is a decision, not an oversight.

Event shape:

```ts
logBusinessEvent({
  event: 'recommendation_impression' | 'recommendation_click',
  details: {
    surface: 'product' | 'cart' | 'home' | 'zero_result',
    anchorProductId: string | null, // null for the personalized home rail
    productIds: string[], // impression: the rendered set; click: one element
    fallback: boolean, // true when bestsellers were served
  },
  success: true,
})
```

---

## Entity mapping back to the spec

| Spec entity             | Implementation                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ProductAffinityScore`  | The table above                                                                                                |
| `RecommendationSignal`  | Weights and thresholds in `src/features/recommendations/constants.ts`; not persisted — the score is the output |
| `RecommendationSurface` | A discriminated union `RecommendationSurface` in `validations.ts` plus one selection entry point per surface   |
| `RecommendationEvent`   | Structured log event (above)                                                                                   |

---

## Transport type — `RecommendationItem`

Declared in `src/features/recommendations/validations.ts`. This is the **only**
shape a recommendation surface returns, on both the scored and the fallback
branch.

```ts
export type RecommendationItem = Pick<
  Product,
  'id' | 'name' | 'description' | 'image' | 'category'
> & {
  price: number // INR, the storage base currency
  inStock: boolean // collapsed from variant stock; never a magnitude
}
```

It deliberately **excludes** the `stock: number` and `soldCount: number`
fields carried by `ProductGridItem`
(`src/features/product/components/ProductGrid.tsx`). Returning
`ProductGridItem` would disclose exact stock and sales volume, violating
FR-010 and SC-003. Stock is read by the eligibility predicate, collapsed to
`inStock`, and the numeric value is discarded before serialization.

---

## Constants (`src/features/recommendations/constants.ts`)

```ts
export const AFFINITY_WINDOW_DAYS = 180
export const MIN_SUPPORT = 3
export const MAX_PAIRS_PER_ANCHOR = 24
export const RAIL_SIZE = 8
export const ANCHOR_BATCH_SIZE = 250

export const SIGNAL_WEIGHTS = {
  purchase: 1.0,
  wishlist: 0.5,
  share: 0.25,
} as const
```

`MIN_SUPPORT = 3` is the privacy threshold from R-003 and is enforced in the
aggregation `HAVING` clause so sub-threshold pairs never reach the table.

---

## Cache keys and TTLs (`src/lib/cache.ts`)

Additions, following the existing naming style
(`PRODUCTS_BESTSELLERS_BY_LIMIT`, `PRODUCT_BY_ID`):

```ts
CACHE_KEYS.RECOMMENDATIONS_BY_ANCHOR = (anchorId: string, limit: number) =>
  `recommendations:anchor:${anchorId}:${limit}`
CACHE_KEYS.RECOMMENDATIONS_BY_ANCHOR_SET = (
  anchorHash: string,
  limit: number
) => `recommendations:anchors:${anchorHash}:${limit}`
CACHE_KEYS.RECOMMENDATIONS_STATUS = 'recommendations:status'

CACHE_TTL.RECOMMENDATIONS = 900 //  15 min — scores change once daily
CACHE_TTL.RECOMMENDATIONS_STALE = 60 //  1 min stale-while-revalidate window
CACHE_TTL.RECOMMENDATIONS_STATUS = 60
```

`anchorHash` is a stable hash of the sorted anchor ID set, matching how
`PRODUCT_SOLD_COUNTS(idsHash)` already keys a multi-ID read.

### Invalidation

The scoring job calls `invalidateCache('recommendations:*')` after a
successful run. No `revalidateTag` call is needed, because no recommendation
read sits inside a `"use cache"` scope (R-004). Per Principle IV, invalidation
failures are logged and never fail the job.

---

## Migration

- File: whatever sequence number `db:generate` assigns — `0016_*` at time of
  writing, higher if a parallel feature lands its migration first. Do not
  hardcode the number when implementing.
- Generated by `npm run db:generate` after editing `src/lib/schema.ts`
- Purely additive: one `CREATE TABLE`, three `CREATE INDEX`, two FKs, two
  `CHECK` constraints. No column drop, no backfill, no rewrite of an existing
  table — zero-downtime by construction.
- Applied with `npm run db:migrate` (Constitution workflow step 6).
