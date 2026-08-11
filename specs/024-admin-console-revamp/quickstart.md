# Quickstart: Admin Console Revamp

This walks through verifying the feature's foundational pieces once the
first increment (shared surfaces + one converted resource + activity view)
has landed, per the incremental rollout in FR-I01–FR-I05. It assumes the
repository is already set up per `docs/development.md` (dependencies
installed, `.env.local` populated, database migrated).

## 1. Run the app locally

```bash
npm run dev
```

Sign in as each of the four roles (`ADMIN`, `SUPPORT`, `FULFILMENT`, and a
`CUSTOMER` to confirm they're rejected) to exercise permission-accuracy
checks below. Use existing seed/test accounts per `docs/development.md`.

## 2. Verify the shared list surface (extended `AdminDataView`)

1. Open a converted resource screen (e.g. `/admin/orders` once converted).
2. Confirm: search box with debounced input, filter chips that are
   individually removable plus a "clear all," visible sort indicator on the
   active column, and the four distinct states —
   - Loading (skeleton rows/cards)
   - Empty because zero records exist
   - Empty because the current filter matches nothing (distinct copy)
   - Failed to load, with a retry control
3. Change search/filter/sort/page, then reload the browser at that URL —
   state MUST restore exactly (FR-A07).
4. Select several rows — a bulk action toolbar rises showing only the
   actions permitted to the signed-in role (FR-A09/FR-A14). As
   `FULFILMENT`, confirm "Issue refund" never appears; as `ADMIN`, confirm
   it does.
5. Trigger a bulk action against a small selection; confirm per-row
   success/failure reporting with reasons for failures (FR-A10), and that
   the list reflects new state without a full page reload.
6. Resize the viewport to 375px wide; confirm no action available at
   desktop width is lost and there is no horizontal page scroll (FR-H06,
   FR-A13).

## 3. Verify saved views

1. Apply a search + filter + sort combination, save it as a named view
   (FR-A17).
2. Sign in as a different user with the same permission; confirm the
   saved view from step 1 is NOT visible (FR-A18, SC-018).
3. Confirm any shipped built-in view is visible to every role holding the
   underlying resource's read permission, and is not editable/deletable
   (FR-A20).
4. Clear local browser storage/cookies (keep the session) and reload;
   confirm the private saved view from step 1 still appears (FR-A19 —
   server-persisted, not local-only).

## 4. Verify the activity surface

1. Perform a mutating action (e.g. update an order's status) as any staff
   role permitted to do so.
2. Open that order's detail screen; confirm an activity panel shows the
   change with actor identity, role at the time, timestamp, action, and a
   human-readable before/after (FR-D02, User Story 2 acceptance scenario).
3. Open the global activity view (`/admin/activity`); filter by entity
   type, action, actor, and date range together; confirm results reflect
   all filters combined (FR-D05).
4. As a role without permission to read a given entity type, confirm the
   global view returns no records for that entity type (FR-D09).
5. Confirm the view states the 24-month retention window explicitly
   (FR-D14).

## 5. Verify confirmations

1. Trigger any destructive action (e.g. delete a category); confirm the
   dialog names the specific entity and consequence and states
   reversibility (FR-C02).
2. Trigger a refund, a role change, or a bulk delete; confirm the confirm
   button stays disabled until the required text is typed exactly
   (FR-C03).
3. As any non-`ADMIN` (or as the sole remaining `ADMIN`), attempt to demote
   yourself or remove the last administrator's rights; confirm refusal
   both via the interface and by calling the underlying API route directly
   with a tool like `curl` (FR-C04/FR-C05/SC-016).

## 6. Verify navigation and redirects

1. As each role, open the admin navigation; confirm no entry links to a
   screen that role cannot open (FR-E02).
2. Visit the retired `/admin/sales` address directly; confirm a permanent
   redirect to `/admin` rather than a not-found response (FR-E04/FR-E10).
3. Open the command palette (existing shortcut in `AdminNavLinksClient`)
   and search; confirm results are limited to destinations/actions
   permitted to the signed-in role (FR-E08).

## 7. Automated verification

```bash
npm run lint
npx tsc --noEmit -p tsconfig.check.json
npm run test
npm run docs:check
```

Playwright, including screenshot capture on every modified/converted page:

```bash
npx playwright test playwright-tests/admin-views.spec.ts
npx playwright test playwright-tests/ux-audit.spec.ts
```

Audit-coverage check (SC-005/NFR-006 — asserts every mutating
`src/app/api/admin/**/route.ts` handler calls the audit-write helper):

```bash
npm run test -- admin-audit-coverage
```

(Exact test file name is decided during implementation; wire it into
`npm run test` so it runs in CI by default, not as a separate opt-in script.)

## 8. Schema changes

```bash
npm run db:generate   # after editing src/lib/schema.ts
# review the generated SQL — must be additive only (new columns/indexes,
# new AdminSavedView table); no dropped or renamed columns
npm run db:migrate
```
