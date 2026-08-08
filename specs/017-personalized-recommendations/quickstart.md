# Quickstart: Personalized Recommendations

How to build, run, and verify this feature locally. Assumes the standard
development setup in `docs/getting-started.md` is already working.

---

## 1. Apply the schema change

```bash
# after editing src/lib/schema.ts
npm run db:generate      # emits drizzle/<next-number>_product_affinity_scores.sql
# review the generated SQL before applying
npm run db:migrate
```

Then refresh the bootstrap file so `npm run db:bootstrap` stays current
(Constitution workflow step 6) and commit the schema edit, the migration, and
the refreshed bootstrap SQL together.

Verify the table exists:

```bash
npm run db:studio
```

---

## 2. Populate scores

The scoring function carries both a cron trigger and an event trigger, so
locally you trigger it by event rather than waiting for 04:00 UTC.

```bash
npm run dev            # HTTPS on https://localhost:3000
npx inngest-cli@latest dev -u https://localhost:3000/api/inngest
```

Open the Inngest dev UI, find **Compute product affinity scores**, and invoke
it with:

```json
{ "windowDays": 365, "triggeredBy": "local-dev" }
```

A wide window is useful locally because seeded order data is usually sparse.

Confirm rows landed:

```sql
SELECT COUNT(*), COUNT(DISTINCT "anchorProductId"), MAX("computedAt")
FROM "ProductAffinityScore";
```

If the count is `0`, that is expected on a catalog with fewer than
`MIN_SUPPORT` (3) orders sharing a product pair — every surface should still
render bestsellers. That is the SC-001 cold-catalog case, not a bug.

---

## 3. Verify each surface

| Surface         | URL                   | Expected                                                         |
| --------------- | --------------------- | ---------------------------------------------------------------- |
| Product detail  | `/products/<id>`      | Rail below the fold; never contains `<id>` itself                |
| Cart cross-sell | `/cart` with items    | Suggestions exclude every product already in the cart            |
| Home rail       | `/shop` signed in     | Rail reflects own orders/wishlist; differs from a second account |
| Zero-result     | `/shop?q=zzzzqqqq`    | Recommendations offered alongside the existing empty-state copy  |
| Empty cart      | `/cart` with no items | **No** cross-sell rail at all                                    |
| Guest home      | `/shop` signed out    | Non-personalized rail; no per-user request in the network tab    |

Each rail streams inside its own `Suspense` boundary — you should see
`RecommendationRailSkeleton` first, then content. If a rail blocks the page,
the boundary is placed wrong.

---

## 4. Verify the fallback with Redis down

```bash
# temporarily unset the Upstash credentials
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= npm run dev
```

Every surface must still render, populated by bestsellers, with no error
boundary triggered. This is SC-002. The response payload carries
`fallback: true`.

---

## 5. Verify privacy invariants

- Inspect any recommendation response body: it must contain an `inStock`
  boolean and **no `stock` or `soldCount` field** (FR-010, SC-003). Check the
  bestseller fallback branch too — it maps through the same projection and is
  the easier one to get wrong.
- Sign in as two accounts with different histories and compare the `/shop`
  rails — they must differ (SC-004).
- As a guest, confirm no cache key and no database write is keyed to any
  identifier. The guest branch returns before any per-user read (FR-009).

---

## 6. Verify event recording

Open the network tab and interact with a rail. You should see:

- one `POST /api/recommendations/event` with `type: "impression"` when a rail
  enters the viewport
- one with `type: "click"` and a single-element `productIds` on click

Both are `sendBeacon` requests, so they appear with no response body. Confirm
the corresponding `recommendation_impression` / `recommendation_click` lines
in the dev server log (SC-007).

---

## 7. Verify the admin surface

Sign in as an account holding `system:manage`, then open
`/admin/recommendations`. It must show the last refresh timestamp, pair and
anchor counts, and the active window / minimum-support values. Press
**Recompute now** and confirm a new run appears in the Inngest dev UI and the
timestamp advances (FR-014).

Signing in without `system:manage` must produce a redirect from the page and a
`403` from the routes — never a `401`, which is reserved for no session at all.

---

## 8. Run the gates

All five must pass before a commit:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.check.json
npm test
npm run build
npm run docs:check
```

`npm run build` is mandatory — Next.js route-type and prerender errors surface
only there.

Then the Playwright suite for this feature:

```bash
npx playwright test playwright-tests/recommendations.spec.ts
```

Capture screenshots of the product, cart, shop, and zero-result surfaces for
the PR description (Constitution workflow step 5).

---

## Troubleshooting

| Symptom                                          | Cause                                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Rails always show bestsellers                    | Fewer than `MIN_SUPPORT` orders back any pair. Seed more orders or raise `windowDays`.                                            |
| Rail includes the product being viewed           | The anchor-exclusion filter was bypassed; the DB `CHECK` should make this impossible at write time — check the selection service. |
| Rail blocks first paint                          | The `Suspense` boundary wraps too much of the page, or the rail was awaited in the page body.                                     |
| Scores duplicate after a re-run                  | The delete-then-insert is outside a transaction, or the unique constraint is missing.                                             |
| Admin status shows `null` after a successful run | The run wrote zero rows — see the first row of this table.                                                                        |
