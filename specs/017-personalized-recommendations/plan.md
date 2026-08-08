# Implementation Plan: Personalized Recommendations

**Branch**: `017-personalized-recommendations` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-personalized-recommendations/spec.md`

## Summary

Add a signal-based product recommendation capability. A nightly Inngest cron
function computes directed product-to-product affinity scores from order
co-purchase, wishlist co-occurrence, and share co-occurrence over a bounded
history window, writes them to a new `ProductAffinityScore` table, and records
a refresh timestamp. A new `src/features/recommendations/` module exposes a
selection service that reads those scores through Redis `getCachedData`,
filters out ineligible candidates (soft-deleted, zero sellable stock, the
anchor itself, current cart contents), and degrades to category-scoped
bestsellers whenever scores are missing, empty, or Redis is unavailable.

Four surfaces consume the service — product detail, cart, the `/shop` home
rail, and the zero-result search state — each inside a `Suspense` boundary
with a skeleton so no rail can block or regress page rendering. Impressions
and clicks are recorded through `logBusinessEvent`, mirroring the existing
`/api/search/click` approach, with no new analytics table. An admin page
under `system:manage` shows the last refresh time and triggers a
recomputation by publishing the same Inngest event the cron trigger fires.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), React 19.2, Next.js 16.3 App Router
**Primary Dependencies**: Drizzle ORM 0.45, Inngest 4.13, Upstash Redis 1.38, Zod 4.4, Tailwind CSS v4.3
**Storage**: PostgreSQL (Neon Serverless) — one new table `ProductAffinityScore`; Upstash Redis for read caching
**Testing**: Vitest 4.1 + jsdom + React Testing Library 16.3; Playwright 1.62 for surface verification
**Target Platform**: Serverless on-demand functions (Vercel), Node runtime
**Project Type**: Web application — Next.js App Router monolith under `src/`
**Performance Goals**: Rail resolution p95 < 150 ms on a Redis hit; scoring job completes within the Inngest step budget on a 180-day order window
**Constraints**: No LCP regression on product, cart, or shop pages (rails stream behind `Suspense`); scoring job bounded in rows scanned and memory; no per-user profile persisted for guests; exact stock counts never serialized
**Scale/Scope**: One new feature module, one migration, one cron function, four surfaces, two public API routes, two admin routes, one admin page, one edge route-guard entry

## Constitution Check

_GATE: evaluated against `.specify/memory/constitution.md` v3.0.0._

| Principle                              | Status  | How this plan complies                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Server-First Rendering              | ✅ PASS | Three of four rails (product, cart, zero-result) are Server Components calling the selection service directly. The `/shop` personalized rail is client-seeded by necessity — its recently-viewed input lives in `localStorage` and is unavailable on the server (R-006) — and sits below the fold behind `Suspense`, so its fetch cannot affect LCP. `'use client'` is otherwise confined to `RecommendationTracker`. No `next/dynamic` with `{ ssr: false }`. |
| II. Type Safety End-to-End             | ✅ PASS | Zod schemas in `src/features/recommendations/validations.ts` for both API route bodies and query params. All DB access via Drizzle's typed API. No raw SQL outside the generated migration.                                                                                                                                                                                                                                                                    |
| III. Testing Discipline                | ✅ PASS | Vitest suites mirror source paths under `__tests__/features/recommendations/`. Service-layer coverage target 85% per SC-008. Playwright spec covers all four surfaces plus the Redis-down fallback.                                                                                                                                                                                                                                                            |
| IV. Serverless & Caching Architecture  | ✅ PASS | Scoring runs as an Inngest cron function registered in `src/lib/inngest/registry.ts`. Reads use `getCachedData` with explicit TTL + stale window. No `"use cache"` scope wraps a Redis read. No route segment config added.                                                                                                                                                                                                                                    |
| V. Security by Default                 | ✅ PASS | Admin routes use `checkAdminAuth('system:manage')`; the admin page uses `requireAdminPermission`. Personalized reads are scoped to `session.user.id` only. Guest requests take an anonymous path that writes nothing.                                                                                                                                                                                                                                          |
| VI. Observability & Structured Logging | ✅ PASS | API routes wrapped in `withApiLogging`; errors through `handleApiError` (which already calls `unstable_rethrow` first). Scoring outcomes emitted via `logBusinessEvent` and `step.score()`.                                                                                                                                                                                                                                                                    |
| VII. Simplicity & YAGNI                | ✅ PASS | No ML, no embeddings, no new analytics table, no admin merchandising rules. One table, one job, one selection service. Recommendation events reuse `logBusinessEvent` rather than introducing storage the spec does not require.                                                                                                                                                                                                                               |
| VIII. DRY Shared Utilities             | ✅ PASS | Candidate filtering, fallback, and exclusion live once in `services/selection.ts` and are imported by all four surfaces. Cache keys extend `src/lib/cache.ts`; no per-route duplication.                                                                                                                                                                                                                                                                       |

**Result**: PASS — no violations, Complexity Tracking table omitted.

### Post-Design Re-check

Re-evaluated after Phase 1. Two items required an explicit decision and are
recorded in [research.md](./research.md):

- **R-004** — FR-004 mandates Redis `getCachedData`, while Principle IV forbids
  nesting a Redis read inside a `"use cache"` scope. Resolved by using Redis
  exclusively for recommendation reads and never opening a `"use cache"` scope
  around them. No conflict remains.
- **R-006** — FR-001 lists recently-viewed as a signal, but recently-viewed is
  `localStorage`-only today. Resolved by treating recently-viewed as
  client-supplied **anchor seeds** rather than a scoring input, which avoids
  adding a view-tracking table (Principle VII) and avoids persisting a guest
  profile (FR-009).

Constitution Check still **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/017-personalized-recommendations/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── recommendations-api.md
│   ├── admin-recommendations-api.md
│   └── inngest-events.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── recommendations/                      # NEW module
│       ├── components/
│       │   ├── RecommendationRail.tsx        # Server Component, shared by all surfaces
│       │   ├── RecommendationTracker.tsx     # 'use client' — impression + click beacons
│       │   └── PersonalizedRailSeeds.tsx     # 'use client' — reads recently-viewed seeds
│       ├── services/
│       │   ├── scoring.ts                    # affinity computation (pure + DB reads)
│       │   ├── selection.ts                  # score read, filter, fallback, exclusion
│       │   ├── events.ts                     # impression/click logging
│       │   └── status.ts                     # last-refresh lookup for admin
│       ├── inngest/
│       │   └── affinity.ts                   # cron + on-demand scoring function
│       ├── constants.ts                      # weights, thresholds, window, rail size
│       └── validations.ts                    # Zod schemas for routes
├── app/
│   ├── (public)/
│   │   ├── products/[id]/page.tsx            # MODIFIED — add rail in Suspense
│   │   ├── cart/page.tsx                     # MODIFIED — add cross-sell in Suspense
│   │   └── shop/page.tsx                     # MODIFIED — home rail + zero-result recovery
│   ├── admin/
│   │   └── recommendations/page.tsx          # NEW — status + recompute trigger
│   └── api/
│       ├── recommendations/
│       │   ├── personalized/route.ts         # NEW — GET, seeded personalized rail
│       │   └── event/route.ts                # NEW — POST impression/click
│       └── admin/recommendations/
│           ├── recompute/route.ts            # NEW — POST trigger
│           └── status/route.ts               # NEW — GET last refresh
├── components/skeletons/
│   └── RecommendationRailSkeleton.tsx        # NEW
└── lib/
    ├── schema.ts                             # MODIFIED — productAffinityScores table
    ├── cache.ts                              # MODIFIED — new CACHE_KEYS + CACHE_TTL
    └── inngest/registry.ts                   # MODIFIED — register scoring function

src/proxy.ts                                  # MODIFIED — /admin/recommendations guard
src/features/admin/components/AdminNavLinksClient.tsx  # MODIFIED — nav entry

drizzle/
└── <next>_product_affinity_scores.sql        # NEW migration (number from db:generate)

scripts/sql/
└── bootstrap-drizzle-initial.sql             # MODIFIED — mirror the new migration

__tests__/features/recommendations/
├── services/scoring.test.ts
├── services/selection.core.test.ts           # shared predicate + fallback
├── services/selection.product.test.ts        # US1
├── services/selection.cart.test.ts           # US2
├── services/selection.home.test.ts           # US3
├── services/selection.zero-result.test.ts    # US4
├── services/events.test.ts
└── components/RecommendationRail.test.tsx

playwright-tests/
└── recommendations.spec.ts                   # NEW — four surfaces + fallback

docs/
└── features.md                               # MODIFIED — FR-015
```

**Structure Decision**: A new `src/features/recommendations/` domain module,
following the layout already used by `src/features/cart/` — which is the only
existing module that owns its own `inngest/` directory, the precedent this
feature needs. Shared cache keys and TTLs extend `src/lib/cache.ts` rather
than living in the module, matching how bestsellers keys are declared today.
The scoring function is registered in `src/lib/inngest/registry.ts`, the
single list the signed `/api/inngest` route serves.

## Implementation Phases

### Phase A — Data and scoring (no user-visible change)

1. Add `productAffinityScores` to `src/lib/schema.ts` with the columns and
   indexes in [data-model.md](./data-model.md).
2. `npm run db:generate` → review the generated migration (the sequence number
   is whatever `db:generate` assigns) → `npm run db:migrate` → refresh
   `scripts/sql/bootstrap-drizzle-initial.sql`.
3. Implement `services/scoring.ts`: bounded-window pair extraction, weighted
   aggregation, minimum-support filter, idempotent replace-by-anchor write.
4. Implement `inngest/affinity.ts` with a `cron('0 4 * * *')` trigger and an
   event trigger for on-demand recomputation; register it.
5. Unit tests for weighting, support threshold, window bounding, and re-run
   idempotency.

**Exit criteria**: job runs green on a seeded dataset; re-running produces
identical rows; `npm test` and `npx tsc --noEmit -p tsconfig.check.json` pass.

### Phase B — Selection service and fallback

1. Add `CACHE_KEYS.RECOMMENDATIONS_*` and `CACHE_TTL.RECOMMENDATIONS*` to
   `src/lib/cache.ts`.
2. Implement `services/selection.ts` with a single entry point per surface,
   all sharing one candidate filter, one bestseller fallback, and one
   `toRecommendationItem` projection applied on both branches.
3. Unit tests covering: empty scores, Redis throwing, anchor exclusion, cart
   exclusion, soft-deleted exclusion, zero sellable stock exclusion, and the
   absence of `stock` and `soldCount` in the returned shape on both the
   scored and the fallback branch.

**Exit criteria**: SC-001, SC-002, SC-003 provable at the service layer;
service coverage ≥ 85%.

### Phase C — Surfaces

1. `RecommendationRailSkeleton` + `RecommendationRail` Server Component.
2. Product detail rail, cart cross-sell, `/shop` home rail, zero-result
   recovery — each in its own `Suspense` boundary.
3. `RecommendationTracker` client beacons and `POST /api/recommendations/event`.
4. `GET /api/recommendations/personalized` for the seeded signed-in rail.
5. Playwright spec across all four surfaces plus a Redis-down run.

**Exit criteria**: SC-004, SC-005, SC-007 verified; screenshots captured.

### Phase D — Admin and documentation

1. `GET /api/admin/recommendations/status`, `POST /api/admin/recommendations/recompute`.
2. `/admin/recommendations` page behind
   `requireAdminPermission('system:manage', '/admin/recommendations')`, with the
   matching edge guard registered in `src/proxy.ts` and a nav entry in
   `AdminNavLinksClient.tsx`.
3. Measure the scoring job against a representative order volume and record the
   runtime (SC-006).
4. `docs/features.md` section; `npm run docs:check` green.

**Exit criteria**: FR-014, FR-015, SC-006 satisfied; full pre-PR gate green.

## Risks and Mitigations

| Risk                                                              | Mitigation                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Scoring job exceeds the function timeout as the order table grows | Fixed 180-day window, `step.run` chunking by anchor batch, and a hard cap on pairs per anchor (`MAX_PAIRS_PER_ANCHOR`)  |
| Single-order association leaks a customer's basket                | `MIN_SUPPORT = 3` distinct orders; enforced in the aggregation query, not in the reader                                 |
| A rail regresses LCP on the product page                          | Rails render below the fold inside `Suspense` with a skeleton; no rail is part of the LCP element                       |
| Cache stampede on a popular anchor                                | `getCachedData` stampede lock, already in production for bestsellers                                                    |
| Guest personalization accidentally persists a profile             | The personalized route returns the anonymous bestseller path before touching any per-user read when there is no session |
| Bootstrap SQL drifts from the new migration                       | Phase A step 2 refreshes `scripts/sql/bootstrap-drizzle-initial.sql` in the same commit as the migration                |

## Complexity Tracking

Not applicable — Constitution Check passed with no violations.
