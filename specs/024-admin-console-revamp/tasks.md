# Tasks: Admin Console Revamp

**Input**: Design documents from `/specs/024-admin-console-revamp/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included. Constitution Principle III (Testing Discipline) and the plan's
Testing section require unit tests under `__tests__/` mirroring `src/`, Playwright
coverage with screenshots for every converted/new screen, and an automated
audit-coverage check (SC-005/NFR-006). Tests are written before the implementation
they verify wherever the implementation is new (shared surfaces, activity API,
saved-views API, retention job); for the twelve screen-conversion tasks, existing
Playwright/unit suites are extended in place rather than duplicated.

**Organization**: Tasks are grouped by user story (US1–US4) per spec.md priorities,
preceded by Setup and Foundational phases that build the shared surfaces every
story consumes (per FR-I02: shared surfaces land before consuming screens).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, US4 — omitted for Setup/Foundational/Polish
- File paths are exact and relative to the repository root

## Path Conventions

Single Next.js project. All work is inside `src/app/admin/`, `src/app/api/admin/`,
`src/features/admin/`, `src/lib/`, `__tests__/`, and `playwright-tests/`, per
plan.md's Project Structure. No new top-level directory is introduced.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema changes, dependency-free scaffolding needed before any
foundational or story work begins.

- [x] T001 Add additive columns/indexes to `adminAuditLogs` in `src/lib/schema.ts`: composite index on `(entity, entityId, createdAt)` (FR-D06/NFR-007), composite index on `(action, createdAt)` (FR-D05); decide during this task whether nullable `actorName`/`actorEmail` denormalised columns are needed per research.md §4, adding them only if a join-cost check (against seeded data volume) shows it's warranted
- [x] T002 Add the new `adminSavedViews` table (`AdminSavedView`) to `src/lib/schema.ts` per data-model.md §2 — `id` (varchar(7) short-id PK), `ownerId` (nullable FK → `users.id`, cascade), `resource`, `name`, `criteria` (json), `isBuiltIn` (boolean, default false), `requiredPermission` (nullable), `createdAt`, `updatedAt`, plus indexes `(ownerId, resource)` and `(resource, isBuiltIn)`, and its `relations()` block
- [x] T003 Run `npm run db:generate`, review the generated SQL to confirm it is additive only (new columns/indexes, new table — no drop/rename), then run `npm run db:migrate`
- [x] T004 [P] Add Zod schemas for the activity query, saved-view criteria, and saved-view create/rename request shapes in `src/lib/validations/admin.ts` (new or extended file), matching the shapes in `contracts/activity-api.md` and `contracts/saved-views-api.md`
- [x] T005 [P] Seed the built-in shared saved views (FR-A20) as a data-seeding script or migration-adjacent seed step, gated by `requiredPermission` per resource, consistent with the project's existing seed conventions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared list, form, and confirmation surfaces, the activity read
path, and the saved-views API — every consuming screen in Phases 3–6 depends on
these (FR-I02: "shared surfaces MUST land before the screens that consume them").

**⚠️ CRITICAL**: No screen-conversion task (US1, US3, US4) or activity-consuming
task (US2) may start until this phase's checkpoint is reached.

### Shared list surface (extends `AdminDataView`)

- [x] T006 [P] Unit test for `useAdminListState` URL serialization (search/filters/sort/cursor round-trip) in `__tests__/features/admin/hooks/useAdminListState.test.ts`
- [x] T007 Implement `useAdminListState` hook (Next.js `useSearchParams`/`useRouter`) in `src/features/admin/hooks/useAdminListState.ts` per research.md §2 — serializes search text, active filters, sort column/direction, and cursor into the query string; screen-local state only, not promoted to Redux (FR-F05)
- [x] T008 [P] Define the `ResourceListDefinition<T>` type and supporting `FilterDefinition`/`RowAction`/`BulkAction`/`BulkSelection`/`BulkResult` types in `src/features/admin/components/resource-list-definition.ts` per `contracts/resource-list-definition.md` and data-model.md §3
- [x] T009 [P] Unit tests for `AdminDataView`'s four list states (loading / empty-no-records / empty-filtered / failed-with-retry) in `__tests__/features/admin/components/AdminDataView.test.tsx` — write/extend to assert on the new state prop shape before implementing it
- [x] T010 Extend `src/features/admin/components/AdminDataView.tsx` in place (not a new component, per research.md §1): accept a `ResourceListDefinition`, add row-selection state, a bulk-action-toolbar render slot, filter-chip rendering with a "clear all" control, visible sort indication, and replace the single `loading`/`emptyMessage` props with the four distinct states (FR-A02–FR-A05, FR-A09, FR-A11) — depends on T007, T008
- [x] T011 [P] Implement `AdminBulkActionBar.tsx` in `src/features/admin/components/AdminBulkActionBar.tsx` — renders only the bulk actions passed to it (already permission-filtered by the caller per NFR-010), shows selection count, and renders per-row succeeded/failed outcome with retry for failed rows after an action completes (FR-A09/FR-A10) — depends on T008
- [x] T012 [P] Implement the "apply to entire filtered result set" opt-in control (FR-A16) as part of `AdminBulkActionBar.tsx` or a small sibling component — never the default when "select all" is checked
- [x] T013 [P] Implement CSV export control with progress/completion/failure reporting inside `AdminDataView.tsx` (or a small `AdminExportControl.tsx` sibling), wired to the existing `export/*` routes without changing their contract (FR-A12)
- [x] T014 Unit test for accessible-name/keyboard-operability of `AdminDataView`'s new controls (selection checkboxes, sort headers, filter chips, bulk toolbar buttons) in `__tests__/features/admin/components/AdminDataView.a11y.test.tsx` (FR-H01, FR-H03) — depends on T010, T011

### Saved views

- [x] T015 [P] Unit tests for saved-view query scoping (`WHERE ownerId = :currentUserId OR (isBuiltIn = true AND requiredPermission check)`) in `__tests__/features/admin/services/saved-views.test.ts`, asserting cross-user invisibility (FR-A18, SC-018)
- [x] T016 Implement `src/features/admin/services/saved-views.ts` — list/create/rename/delete query functions against `adminSavedViews`, enforcing the ownership/visibility rule at the query layer (never client-side filtering), per data-model.md §2 and research.md §3 — depends on T002, T004
- [x] T017 [P] Contract tests for `GET/POST /api/admin/saved-views` and `PATCH/DELETE /api/admin/saved-views/[id]` in `__tests__/app/api/admin/saved-views/route.test.ts` and `__tests__/app/api/admin/saved-views/[id]/route.test.ts`, covering the 401/403/400/404 failure modes in `contracts/saved-views-api.md`
- [x] T018 Implement `src/app/api/admin/saved-views/route.ts` (`GET` list, `POST` create) per `contracts/saved-views-api.md` — `checkAdminAuth` gated by the resource's read permission, server sets `ownerId`/`isBuiltIn`, Zod-validates `criteria` — depends on T004, T016
- [x] T019 Implement `src/app/api/admin/saved-views/[id]/route.ts` (`PATCH` rename, `DELETE`) per `contracts/saved-views-api.md` — rejects `403` when `ownerId !== currentUserId` or `isBuiltIn === true`, `404` for a private view belonging to someone else — depends on T016
- [x] T020 [P] Implement `useSavedViews` hook in `src/features/admin/hooks/useSavedViews.ts` — fetches visible views for a resource, exposes save/rename/delete/recall actions calling the saved-views API — depends on T018, T019
- [x] T021 [P] Implement `AdminSavedViewPicker.tsx` in `src/features/admin/components/AdminSavedViewPicker.tsx` — "Save this view" affordance and a picker that recalls a saved view by re-applying its `criteria` into `useAdminListState` (FR-A17) — depends on T007, T020

### Confirmation primitive

- [x] T022 [P] Unit tests for `AdminConfirmDialog` (focus trap, escape-to-close, focus restore, typed-confirmation gating, outcome rendering) in `__tests__/features/admin/components/AdminConfirmDialog.test.tsx` per `contracts/confirmation-primitive.md`
- [x] T023 Implement `AdminConfirmDialog.tsx` in `src/features/admin/components/AdminConfirmDialog.tsx` superseding `DeleteConfirmModal` — supports `reversible`, optional `typedConfirmationValue`, renders `ConfirmOutcome` (success/partial/failure) before closing, traps focus, closes on Escape, disables the confirm control (not merely inert) until the typed value matches (FR-C01–FR-C03, FR-C07, FR-H02) — depends on T022
- [x] T024 Migrate every existing `DeleteConfirmModal` call site to `AdminConfirmDialog` with `reversible: false` and no typed confirmation, then delete `src/features/admin/components/DeleteConfirmModal.tsx` (FR-C01: exactly one confirmation primitive) — depends on T023

### Activity read path

- [x] T025 [P] Unit tests for the diff-to-`changes` normalisation helper (one consistent shape across entity types, FR-D03) in `__tests__/features/admin/services/admin-activity-query.test.ts`
- [x] T026 Implement read-side query helpers in `src/features/admin/services/admin-activity-query.ts` (sibling to `admin-audit-log.ts`) — cursor-paginated global query with `entity`/`action`/`actorId`/`dateFrom`/`dateTo` filters, a per-entity query (`entity` + `entityId`), and the diff-to-`changes` normaliser, server-side permission-restricted per entity type (FR-D09) — depends on T001, T004
- [x] T027 [P] Contract tests for `GET /api/admin/activity` (global and per-entity modes, all failure modes) in `__tests__/app/api/admin/activity/route.test.ts` per `contracts/activity-api.md`
- [x] T028 Implement `src/app/api/admin/activity/route.ts` — `checkAdminAuth(system:manage)` for global mode, entity-specific read permission for per-entity mode, Zod-validates query params, returns `entries`/`nextCursor`/`retentionWindowMonths: 24` (FR-D04–FR-D06, FR-D09, FR-D14) — depends on T004, T026
- [x] T029 [P] Implement `AdminActivityPanel.tsx` in `src/features/admin/components/AdminActivityPanel.tsx` — per-entity activity history, newest first, paginated, rendering actor identity/role-at-time/timestamp/action/before-after per change (FR-D06) — depends on T028
- [x] T030 [P] Implement `AdminActivityFilters.tsx` in `src/features/admin/components/AdminActivityFilters.tsx` — entity type / action / actor / date-range filters applied in combination for the global view (FR-D05) — depends on T028
- [x] T031 [P] Unit tests for `AdminActivityPanel` and `AdminActivityFilters` rendering (actor/role/timestamp/before-after shape, combined-filter application) in `__tests__/features/admin/components/AdminActivityPanel.test.tsx` and `__tests__/features/admin/components/AdminActivityFilters.test.tsx`

### Audit-write coverage (write-side completeness, prerequisite for US2's trust guarantee)

- [x] T032 [P] Write the automated audit-coverage check (SC-005/NFR-006) asserting every mutating handler under `src/app/api/admin/**/route.ts` calls `recordAdminAuditLog`, in `__tests__/lib/features/admin/admin-audit-coverage.test.ts`, wired into `npm run test` by default (not an opt-in script)
- [x] T033 Audit every mutating `src/app/api/admin/**/route.ts` handler against the ~40-route inventory in spec.md's Baseline; add missing `recordAdminAuditLog` calls until T032 passes with zero exceptions (FR-D01) — depends on T032
- [x] T034 [P] Add a denylist-enforcing serialization helper (or extend the existing diff-building call sites) ensuring no `diff` may contain password/token/payment-instrument keys (FR-D11), used by every call site that builds a diff — single shared implementation, not per-call-site duplication (Constitution Principle VIII)
- [x] T035 [P] Add a caught/logged failure path around `recordAdminAuditLog` so a write failure is reported to operational monitoring/logging without failing the originating mutation (FR-D10)

### Activity retention job

- [x] T036 [P] Unit test for the retention deletion logic (rows older than 24 months hard-deleted; nothing newer touched) in `__tests__/lib/inngest/functions/activity-retention.test.ts`
- [x] T037 Implement `src/lib/inngest/functions/activity-retention.ts` — Inngest cron function deleting `AdminAuditLog` rows older than 24 months, reporting successes/failures to logging/monitoring (FR-D12/D13) per research.md §5 — depends on T001, T036
- [x] T038 Register `activity-retention.ts`'s function in `src/lib/inngest/registry.ts` alongside `email-retry.ts`/`exchange-rates.ts`/`stock-reservations.ts` — depends on T037

### Command palette permission-accuracy

- [x] T039 [P] Unit test asserting the command palette's item list is filtered to only destinations/quick actions the current user's permissions allow, in `__tests__/features/admin/components/AdminNavLinksClient.test.tsx` (extend existing test)
- [x] T040 Extend `src/features/admin/components/AdminNavLinksClient.tsx`'s `CommandPalette` to filter its item list by the current user's permission set before rendering, mirroring server-rendered `AdminNavLinks` gating (FR-E02, FR-E08) — depends on T039

**Checkpoint**: Shared list surface, saved views, confirmation primitive, activity
read path, audit-write coverage, retention job, and command-palette filtering are
all in place and independently testable. User-story screen work may now begin.

---

## Phase 3: User Story 1 - Fulfilment staff clear the day's order queue (Priority: P1) 🎯 MVP

**Goal**: Fulfilment staff can find, filter, bulk-act on, and export orders from a
permission-accurate dashboard and order queue, using the extended `AdminDataView`
and `AdminBulkActionBar`.

**Independent Test**: Sign in as `FULFILMENT`, complete an eleven-order status
change end to end starting from the dashboard, and confirm only permitted actions
are offered.

### Tests for User Story 1

- [x] T041 [P] [US1] Extend `playwright-tests/admin-views.spec.ts` with a `FULFILMENT`-role scenario: dashboard queue link → orders list pre-filtered → select 11 rows → bulk "Mark as shipped" offered, "Issue refund" absent → apply → per-row success/failure reported → list updates without full reload, with screenshot capture
- [x] T042 [P] [US1] Unit test for the orders `ResourceListDefinition` (`src/features/admin/resources/orders.ts`) asserting `rowActions`/`bulkActions` are correctly filtered per permission set, in `__tests__/features/admin/resources/orders.test.ts`
- [x] T043 [P] [US1] Unit tests for each dashboard actionable-queue query (orders awaiting fulfilment, stock below threshold, failed emails, reviews awaiting moderation, refunds in progress) in `__tests__/app/admin/page.test.ts`, including one queue's isolated failure not blocking the others (FR-G06)

### Implementation for User Story 1

- [x] T044 [P] [US1] Define the `ResourceListDefinition` for orders in `src/features/admin/resources/orders.ts` — columns, filters (status, shipping method, date), sort options, `searchable: true`, permission-filtered row actions and bulk actions (mark shipped, cancel, refund gated on `orders:refund`), `exportable: true`, distinct empty/filtered-empty messages (FR-A02–FR-A05, FR-A09, FR-A14, FR-A15)
- [x] T045 [US1] Convert `src/app/admin/orders/page.tsx` to consume the extended `AdminDataView` with the orders `ResourceListDefinition`, replacing its existing bespoke wiring atomically (no dual implementation, FR-I03) — depends on T010, T044
- [x] T046 [P] [US1] Define each dashboard `Actionable queue` tuple (`resource`, `filter`, `permission`) — orders awaiting fulfilment, stock below threshold, failed emails, reviews awaiting moderation, refunds in progress — in `src/features/admin/services/actionable-queues.ts` per data-model.md §5
- [x] T047 [US1] Rebuild `src/app/admin/page.tsx` so its primary content is actionable-queue cards, each behind its own `Suspense` boundary reading `actionable-queues.ts` (FR-G01–G04, FR-G06, FR-G07), with existing analytics figures relocated to a secondary `analytics:read`-gated section (not recomputed) — depends on T046
- [x] T048 [US1] Wire the CSV export control (T013) into the orders list screen for the existing `export/orders` route, surfacing progress/completion/failure (FR-A12, User Story 1 acceptance scenario 6) — depends on T013, T045
- [x] T049 [US1] Add live-region announcements for bulk-action progress/success/failure and export progress/completion/failure on the orders screen (FR-H04) — depends on T045, T048
- [x] T050 [US1] Add permanent redirect route for `/admin/sales` → `/admin` in `src/app/admin/sales/page.tsx` (replacing `AdminSalesDashboardClient` usage there), per FR-E04/FR-E10 and research.md §8 — depends on T047

**Checkpoint**: User Story 1 is fully functional and independently testable —
dashboard queues, orders list on the extended surface, bulk actions, export, and
the retired `/admin/sales` redirect all work end to end for `FULFILMENT`.

---

## Phase 4: User Story 2 - Support agent investigates a disputed order (Priority: P1)

**Goal**: Every order/product/user detail screen shows its own activity history,
and a global activity view supports combined filtering — making the existing,
previously-unreadable audit trail visible.

**Independent Test**: Perform a mutating admin action, confirm it appears in both
the entity's activity panel and the global activity view with correct actor,
timestamp, action, and before/after values.

### Tests for User Story 2

- [x] T051 [P] [US2] Extend `playwright-tests/admin-views.spec.ts`: perform an order status change, open the order detail screen, confirm the activity panel shows actor/role/timestamp/action/before-after; open `/admin/activity`, filter by entity+action+actor+date together, confirm combined results, with screenshot capture
- [x] T052 [P] [US2] Playwright/unit test confirming a viewer without permission to read an entity type receives no records for that type from the global activity view (FR-D09, acceptance scenario 6) in `__tests__/app/api/admin/activity/route.test.ts` (extend from T027)

### Implementation for User Story 2

- [x] T053 [P] [US2] Mount `AdminActivityPanel` on the order detail screen (`src/app/admin/orders/[id]/page.tsx` or equivalent order detail composition) gated by `orders:read` — depends on T029
- [x] T054 [P] [US2] Mount `AdminActivityPanel` on the product detail screen (`src/app/admin/products/[id]/page.tsx`) gated by `products:read` — depends on T029
- [x] T055 [P] [US2] Mount `AdminActivityPanel` on the user detail screen (wherever user detail is presented, e.g. within `src/features/admin/components/UsersTable.tsx`'s expanded row or a new user detail screen) gated by `users:read` — depends on T029
- [x] T056 [US2] Create `src/app/admin/activity/page.tsx` — the global activity view, gated by `requireAdminPermission('system:manage')`, composing `AdminActivityFilters` and a paginated list of entries, stating the 24-month retention window explicitly (FR-D04, FR-D14) — depends on T028, T030
- [x] T057 [US2] Add `/admin/activity` to the navigation grouping and command palette entries (coordinates with T040's permission filtering) — depends on T056, T040

**Checkpoint**: User Stories 1 AND 2 both work independently — order queue
operations plus full activity visibility on entity detail screens and globally.

---

## Phase 5: User Story 3 - Administrator maintains the catalogue and the team (Priority: P2)

**Goal**: One canonical create/edit pattern (overlay vs. dedicated screen by a
documented rule), consistent validation/dirty-state/save-cancel behaviour, and the
single confirmation primitive for role changes, refunds, and bulk deletes,
including self-demotion and last-administrator refusal.

**Independent Test**: Create and edit one record of each supported type; confirm
identical validation, dirty-state, and save/cancel behaviour across all of them.

### Tests for User Story 3

- [x] T058 [P] [US3] Unit test documenting and asserting the overlay-vs-dedicated-screen rule (e.g. field count / nested-structure threshold) in `__tests__/features/admin/services/form-presentation-rule.test.ts`
- [ ] T059 [P] [US3] Extend `playwright-tests/admin-views.spec.ts`: create/edit a category (currently inline), a coupon, and a product, confirming identical field-error placement, error-summary count, unsaved-changes warning, and duplicate-submission prevention across all three, with screenshot capture
- [x] T060 [P] [US3] Unit/Playwright test for self-demotion refusal (own role reduction, own admin-permission removal) and last-administrator-removal refusal, both via the interface and via a direct API call bypassing it, in `__tests__/app/api/admin/users/[id]/route.test.ts` (extend existing) (FR-C04/FR-C05, SC-016)
- [x] T061 [P] [US3] Unit test for typed-confirmation gating on refund, role-change, and bulk-delete call sites specifically (each site's expected typed value) in `__tests__/features/admin/components/AdminConfirmDialog.typed-actions.test.tsx`

### Implementation for User Story 3

- [x] T062 [US3] Document the single overlay-vs-dedicated-screen rule (FR-B02) in `src/features/admin/services/form-presentation-rule.ts` — a small typed function/table keyed on record complexity, consumed by every create/edit call site — depends on T058
- [x] T063 [P] [US3] Eliminate `CategoriesClient.tsx`'s inline row editing; convert category create/edit to the rule from T062 (overlay, given its low field count) (FR-B03) — depends on T062
- [x] T064 [P] [US3] Convert `CouponsClient.tsx`'s create/edit to the same rule/overlay pattern, replacing any bespoke modal wiring with the canonical form surface (FR-B01) — depends on T062
- [x] T065 [P] [US3] Confirm/align `ProductFormModal.tsx`/`VariantFormModal.tsx`/`ProductEditPageForm.tsx` against the canonical rule from T062 (already overlay/dedicated-screen split per Baseline — verify it matches the documented rule and adjust if not) — depends on T062
- [x] T066 [US3] Add a shared field-error/error-summary rendering pattern used by every converted form (categories, coupons, products) — adjacent field errors plus a count summary (FR-B04) — depends on T063, T064, T065
- [x] T067 [US3] Add a shared unsaved-changes guard (navigation/close interception) used by every converted form (FR-B05) — depends on T063, T064, T065
- [x] T068 [US3] Add consistent save/cancel affordance positioning and duplicate-submission prevention while a save is in flight, across all converted forms (FR-B06) — depends on T066, T067
- [x] T069 [US3] Add stale-record detection (modified/deleted by another user since the form opened) surfaced distinctly from validation failure, across all converted forms (FR-B07/FR-B08) — depends on T066
- [x] T070 [P] [US3] Migrate the role-change call site (`RoleAction.tsx`) to `AdminConfirmDialog` with `typedConfirmationValue` set to a documented per-action string (FR-C03) — depends on T023
- [x] T071 [P] [US3] Migrate the refund call site (order refund action) to `AdminConfirmDialog` with `typedConfirmationValue` (FR-C03) — depends on T023
- [x] T072 [P] [US3] Migrate every bulk-delete call site to `AdminConfirmDialog` with `typedConfirmationValue` (FR-C03) — depends on T023, T011
- [x] T073 [US3] Verify/enforce server-side self-demotion and last-administrator-removal refusal in the users role-update route (`src/app/api/admin/users/[id]/route.ts`), independent of and prior to any confirmation dialog (FR-C04/FR-C05) — depends on T060

**Checkpoint**: User Stories 1, 2, AND 3 all work independently — order queue,
activity visibility, and consistent forms/confirmations across categories,
coupons, products, and role management.

---

## Phase 6: User Story 4 - Any staff member finds their way around (Priority: P2)

**Goal**: Navigation grouped by purpose, no duplicate screens, every screen states
its purpose, and the command palette reaches exactly what the user is permitted to
open — plus conversion of the remaining list screens (users, products, reviews,
returns, checkout-requests, recommendations, email-failures, search) onto the
extended `AdminDataView`.

**Independent Test**: Ask a person unfamiliar with the console to locate five named
capabilities; measure success rate and time without assistance.

### Tests for User Story 4

- [x] T074 [P] [US4] Unit test asserting every admin navigation entry resolves to a screen the rendering user is permitted to open, per role, in `__tests__/features/admin/components/AdminNavLinks.test.tsx` (extend existing) (FR-E02, SC-010)
- [x] T075 [P] [US4] Extend `playwright-tests/admin-views.spec.ts` covering the converted users, products, reviews, returns, checkout-requests, recommendations, email-failures, and search screens on the shared surface, confirming the returns state machine and reservation-release retain every action (FR-A15a), with screenshot capture
- [x] T076 [P] [US4] Extend `playwright-tests/ux-audit.spec.ts` with an accessibility sweep (axe/WCAG 2.1 AA) across every converted and new screen in both themes (FR-H05, SC-011)
- [x] T077 [P] [US4] Test confirming every retired admin address (per the redirect map) permanently redirects to its survivor with no not-found response, in `__tests__/app/admin/redirects.test.ts` (FR-E03/FR-E10, SC-017)

### Implementation for User Story 4

- [x] T078 [P] [US4] Define the `ResourceListDefinition` for users in `src/features/admin/resources/users.ts` and convert `UsersTable.tsx`/`src/app/admin/users/page.tsx` onto the extended `AdminDataView` (FR-A15) — depends on T010
- [x] T079 [P] [US4] Define the `ResourceListDefinition` for products in `src/features/admin/resources/products.ts` and convert `src/app/admin/products/page.tsx` onto the extended `AdminDataView` (FR-A15) — depends on T010
- [x] T080 [P] [US4] Define the `ResourceListDefinition` for reviews in `src/features/admin/resources/reviews.ts` and convert `src/app/admin/reviews/page.tsx` onto the extended `AdminDataView` (FR-A15) — depends on T010
- [x] T081 [P] [US4] Define the `ResourceListDefinition` for returns in `src/features/admin/resources/returns.ts` and convert `src/app/admin/returns/page.tsx` (`AdminReturnsClient`/`AdminReturnCard`) onto the extended `AdminDataView`, retaining the full `018` state machine (approve, reject, receive, refund, COD settle) as row/bulk actions (FR-A15a) — depends on T010
- [x] T082 [P] [US4] Define the `ResourceListDefinition` for checkout-requests in `src/features/admin/resources/checkout-requests.ts` and convert `src/app/admin/checkout-requests/page.tsx` onto the extended `AdminDataView`, retaining `ReleaseReservationButton`'s reservation-release action (FR-A15a, FR-E07a) — depends on T010
- [x] T083 [P] [US4] Convert `src/app/admin/recommendations/page.tsx` onto the extended `AdminDataView` where applicable, retaining recompute/status reporting (FR-E07b) — depends on T010
- [x] T084 [P] [US4] Define the `ResourceListDefinition` for email-failures in `src/features/admin/resources/email-failures.ts` and convert `EmailFailuresClient.tsx`/`src/app/admin/email-failures/page.tsx` onto the extended `AdminDataView` (FR-A15) — depends on T010
- [x] T085 [US4] Reorganise `src/features/admin/components/AdminNavLinks.tsx` and `AdminNavLinksClient.tsx` into coherent groups (commerce operations, catalogue, people, operations) per FR-E01/FR-E05, moving checkout-requests/recommendations/email-failures/search into the operations grouping — depends on T040
- [ ] T086 [US4] Add/update `src/features/admin/components/AdminBreadcrumbs.tsx` usage on every screen to reflect the new grouping consistently (FR-E09) — depends on T085
- [ ] T087 [US4] Add a stated-purpose string/heading to every admin screen (FR-E06), including checkout-requests' triage purpose (FR-E07a) and recommendations' scoring-job-reporting purpose (FR-E07b)
- [x] T088 [US4] Build the `retired → survivor` redirect map in `src/features/admin/services/admin-redirects.ts` and add a minimal permanent-redirect route for every retired admin address beyond `/admin/sales` identified during navigation regrouping (FR-E03/FR-E10) — depends on T085

**Checkpoint**: All four user stories are independently functional. Every list
screen named in FR-A15/FR-A15a is on the shared surface; navigation, breadcrumbs,
purposes, and redirects are consistent; the command palette reaches exactly what
each role may open.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification and hardening that spans all user stories.

- [x] T089 [P] Run `npm run lint` and `npx tsc --noEmit -p tsconfig.check.json`, fixing any violations introduced by the above phases
- [ ] T090 [P] Verify NFR-009 (no increase in database round trips for any existing admin screen) by comparing query counts before/after conversion for each converted screen
- [ ] T091 [P] Verify NFR-004 (list responsiveness against 100k+ underlying rows) and NFR-007 (activity view first page within 1s p75 against a full 24-month window) against a representative seeded/staging dataset
- [ ] T092 [P] Run the full Playwright suite (`npx playwright test playwright-tests/admin-views.spec.ts` and `playwright-tests/ux-audit.spec.ts`) and capture screenshots for every modified/converted page
- [x] T093 Run `npm run test` (including the audit-coverage check from T032) and `npm run docs:check`; fix any regressions
- [ ] T094 Execute every verification step in `quickstart.md` end to end (roles, list surface, saved views, activity, confirmations, navigation/redirects, automated verification, schema changes) and record results
- [ ] T095 [P] Review the full diff for any lingering `DeleteConfirmModal` references, dual-implementation screens, or route-segment configuration (`dynamic`/`revalidate`/`runtime` exports) introduced accidentally (FR-F04, FR-I03) and remove them
- [x] T096 Consume `createOrdersDefinition` from `src/app/admin/orders/page.tsx`: split the page into a server-component permission gate (`OrdersManagementClient` props) and wire `AdminDataView`'s `definition` prop (columns, filters, bulk actions) instead of the page's own inline `orderColumns`/no bulk wiring; bulk `mark_shipped`/`cancel` now call the existing `/api/admin/orders/bulk` route for both `loaded_page` and `entire_filtered_result` selection scopes — pilot for T097–T099
- [x] T097 [P] Consume `createProductsDefinition` from `src/app/admin/products/page.tsx`, replacing its inline columns/filter/bulk-action wiring the same way as T096 (depends on T096 as the reference pattern)
- [ ] T098 [P] Consume `createUsersDefinition` from `src/features/admin/components/UsersTable.tsx`/`src/app/admin/users/page.tsx`, replacing inline columns and wiring role-change as a definition-driven action (depends on T096)
- [ ] T099 [P] Consume the remaining resource definitions (`reviews`, `returns`, `checkout-requests`, `email-failures`) from their respective admin screens, one screen per commit, verifying no behavioral regression per screen (depends on T096)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001–T005) completion for schema/validation prerequisites — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational (Phase 2) completion.
  - US1 and US2 are both P1 and have no dependency on each other or on US3/US4 — they can proceed in parallel.
  - US3 depends on the confirmation primitive (T023) and `AdminDataView` extension (T010) from Foundational, not on US1/US2's screen conversions.
  - US4's navigation/redirect tasks depend on the per-resource list-definition pattern established in US1 (T044) as a template, and its screen-conversion tasks (T078–T084) depend only on Foundational T010, not on US1–US3 completing.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only. No dependency on US2/US3/US4.
- **User Story 2 (P1)**: Foundational only (specifically the activity read path, T025–T031). No dependency on US1/US3/US4.
- **User Story 3 (P2)**: Foundational only (specifically T010, T023). Independently testable from US1/US2/US4.
- **User Story 4 (P2)**: Foundational only (specifically T010, T040). Uses the orders `ResourceListDefinition` (T044, from US1) as a template but does not require US1 to be deployed.

### Within Each User Story

- Tests are written first and must fail before the corresponding implementation task.
- `ResourceListDefinition` per resource before the screen conversion that consumes it.
- Shared component/service extensions before screen-specific wiring.
- Story's checkpoint validates the story end to end before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked [P] (T004, T005) can run in parallel once T001–T003 land.
- Within Foundational, the five sub-areas — list surface, saved views, confirmation primitive, activity read path, audit-write coverage/retention, command palette — touch disjoint files and can be staffed in parallel; sequence only within each sub-area as its own dependency chain dictates.
- US1 and US2 can be fully staffed in parallel (both P1, no shared files beyond the already-landed Foundational surfaces).
- Within US4, T078–T084 (one `ResourceListDefinition` + screen conversion per resource) are mutually independent and marked [P].

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational sub-areas together:
Task: "Implement useAdminListState hook in src/features/admin/hooks/useAdminListState.ts"
Task: "Implement saved-views service in src/features/admin/services/saved-views.ts"
Task: "Implement AdminConfirmDialog in src/features/admin/components/AdminConfirmDialog.tsx"
Task: "Implement admin-activity-query.ts read-side helpers"
Task: "Write the automated audit-coverage check in __tests__/lib/features/admin/admin-audit-coverage.test.ts"
```

## Parallel Example: User Story 4 screen conversions

```bash
# Launch independent per-resource list-definition + conversion pairs together:
Task: "Define ResourceListDefinition for users and convert admin/users/page.tsx"
Task: "Define ResourceListDefinition for products and convert admin/products/page.tsx"
Task: "Define ResourceListDefinition for reviews and convert admin/reviews/page.tsx"
Task: "Define ResourceListDefinition for returns and convert admin/returns/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories; at minimum the
   list-surface and confirmation-primitive sub-areas are required for US1).
3. Complete Phase 3: User Story 1 (dashboard queues, orders on the shared surface,
   bulk actions, export, `/admin/sales` retirement).
4. **STOP and VALIDATE**: Sign in as `FULFILMENT`, run the eleven-order bulk
   scenario end to end per the Independent Test.
5. Deploy/demo if ready — this is the safest first slice per spec.md's own
   prioritisation rationale (bulk endpoints already exist, no permission
   semantics change).

### Incremental Delivery

1. Setup + Foundational → shared surfaces ready.
2. Add User Story 1 → validate independently → deploy (MVP).
3. Add User Story 2 → validate independently → deploy (activity visibility).
4. Add User Story 3 → validate independently → deploy (forms/confirmations
   consistency).
5. Add User Story 4 → validate independently → deploy (remaining conversions,
   navigation, redirects) — this closes out FR-I05's end-state completion
   criteria.
6. Polish phase → final cross-cutting verification against quickstart.md and all
   Success Criteria.

Per FR-I03/FR-I04, each screen conversion within any phase replaces its
predecessor atomically and the console remains fully functional throughout —
unmigrated screens keep working unchanged alongside migrated ones at every
intermediate point.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (sub-areas can be split as shown
   above).
2. Once Foundational is done:
   - Developer/pair A: User Story 1 (orders + dashboard)
   - Developer/pair B: User Story 2 (activity surfaces)
   - Developer/pair C: User Story 3 (forms + confirmations)
   - Developer/pair D: User Story 4 (remaining conversions + navigation)
3. Stories complete and integrate independently; US4's navigation regrouping task
   (T085) is the one task best sequenced after the other stories' screens exist,
   since it groups all screens including those converted in US1.

---

## Notes

- [P] tasks touch different files with no unmet dependency and can run in parallel.
- [Story] labels map every Phase 3–6 task to its user story for traceability.
- No new permission strings, database round-trip increases, or route-segment
  configuration are introduced by any task (NFR-009, NFR-010, FR-F04) — Polish
  phase T090 and T095 exist specifically to catch regressions on these points.
- `DeleteConfirmModal` is deleted (T024), not kept as a second confirmation
  primitive, per FR-C01.
- Every schema change (T001, T002) is additive only, verified in T003 before
  migrating.
- Commit after each task or logical group; stop at any checkpoint to validate a
  story independently before proceeding.
