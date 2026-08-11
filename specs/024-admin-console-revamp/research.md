# Phase 0 Research: Admin Console Revamp

The spec's Baseline, Assumptions, and Dependencies sections already resolved
every open technical question through direct repository verification (dated
2026-08-10, commit `f257e72`). This document restates those findings in
research format and adds the small number of implementation-mechanism
decisions the plan needs that the spec left to engineering discretion.

## 1. Component foundation for the shared list surface

- **Decision**: Extend `src/features/admin/components/AdminDataView.tsx` in
  place. Do not build a new list component.
- **Rationale**: `AdminDataView` already wraps `zenput`'s `DataTable`,
  `Pagination`, and `SkeletonCard`; supports declarative `columns`, server-side
  pagination, `loading`, `emptyMessage`, `expandedRowRender`, and a
  `renderMobileCard` fallback below 767px. It is the literal "seed" the spec's
  Baseline names. Building a parallel component would violate FR-I03 (no two
  implementations of the same surface reachable at once) the moment both
  existed, and would contradict Constitution Principle VII (no speculative
  abstraction where an adequate primitive exists).
- **Gaps to close on the existing component** (from Baseline + FR-A09–FR-A21):
  row selection state, a bulk-action toolbar slot, filter-chip rendering with
  a "clear all," visible sort indication, URL-reflected query state, a
  saved-view picker slot, and four distinct list states (loading / empty /
  filtered-empty / failed-with-retry) in place of the current single
  `loading` boolean + `emptyMessage` string.
- **Alternatives considered**: Adopting a different third-party admin table
  library — rejected; it would duplicate `zenput`'s existing investment and
  is explicitly Out of Scope ("Replacing … the admin component library").
  Building selection/bulk state as a wrapper _around_ `AdminDataView` rather
  than inside it — rejected because filter chips, sort indication, and the
  four list states need to coordinate with the same server-side pagination
  props `AdminDataView` already owns; a wrapper would either duplicate that
  state or reach into the child, which is worse than extending directly.

## 2. URL-reflected list state (FR-A07)

- **Decision**: A shared hook (`useAdminListState`) built on Next.js
  `useSearchParams`/`useRouter` (App Router) that serializes search text,
  active filters, sort column/direction, and cursor/page into the query
  string, with one hook instance per resource screen.
- **Rationale**: The existing per-screen list clients (`UsersTable`,
  `EmailFailuresClient`, order/product list pages) already manage local
  `useState` for search/pagination; FR-F05 requires interactive state that
  exists only for one screen to remain local to that screen, so this state is
  _not_ promoted to Redux. Reflecting it in the URL (not client-only state)
  is what makes it bookmarkable/shareable per FR-A07, and cursor-based
  pagination (not offset) is preserved per FR-A06/NFR-004.
- **Alternatives considered**: Storing list state in the existing Redux admin
  slice — rejected; it is single-screen state, and FR-F05 explicitly forbids
  promoting screen-local interactive state to shared application state.
  Storing it only in component state with no URL reflection — rejected; it
  fails FR-A07 directly (not bookmarkable/shareable/restorable on reload).

## 3. Saved views storage and scoping (FR-A17–FR-A21)

- **Decision**: One new Drizzle table, `AdminSavedView` (short-id primary
  key, `varchar(7)` per the project's existing ID convention in
  `src/lib/short-id.ts`), with `ownerId` (nullable — null denotes a built-in
  shared view), `resource`, `name`, `criteria` (JSON: search/filters/sort),
  `isBuiltIn` boolean, and `requiredPermission` (nullable, used only by
  built-in views per FR-A20), plus indexes on `(ownerId, resource)` and
  `(resource, isBuiltIn)`.
- **Rationale**: The spec's Assumptions state this storage does not exist
  today and must be additive, touching no existing table — a new table is
  the only option consistent with that constraint. User-created views must
  be invisible to every other user regardless of permission (FR-A18), so
  ownership is enforced at the query layer (`WHERE ownerId = :currentUserId
OR isBuiltIn = true`), never by a shared "visibility" flag a user could
  set. Built-in views ship as seed data gated by `requiredPermission`,
  matching FR-A20's "visible only to users holding the permission required
  by the underlying resource."
- **Alternatives considered**: Persisting saved views in Edge Config or
  Redis — rejected; both are documented in the constitution as unsuitable
  for user-owned, frequently-changing, per-user records (Edge Config is for
  rarely-changing config; Redis is a cache, not a system of record, and
  saved views must survive indefinitely per FR-A19). Client-only
  (localStorage) persistence — rejected outright by FR-A19 ("survive
  clearing of local browser state" and "available … from any device").

## 4. Activity/audit read path (FR-D01–FR-D14)

- **Decision**: Extend the existing `AdminAuditLog` table
  (`src/lib/schema.ts`) with additive, nullable columns needed for
  denormalised actor display and filtering (the `role` column already
  exists; add whatever indexes the query patterns in FR-D05 require beyond
  the existing `userId`/`entity`/`createdAt` indexes — e.g. a composite for
  entity+entityId lookups used by per-entity panels). Add read-side query
  helpers to `admin-audit-log.ts` (or a sibling `admin-activity-query.ts`)
  and one API route (`/api/admin/activity`) serving both the global view
  (FR-D04/D05) and per-entity panels (FR-D06) via query parameters, backed
  by cursor pagination for the same reason list screens use it (NFR-007
  against a 24-month, high-volume table).
- **Rationale**: The Baseline is explicit that the writer
  (`recordAdminAuditLog`) exists and is called from mutating operations, but
  **no reader exists anywhere in the tree**. FR-D03 requires one consistent
  change-set shape renderable by a single presentation — the existing `diff`
  JSON column plus the `entity`/`entityId`/`action`/`role` columns already
  provide that shape; no redesign of the write path is needed, only a
  verified-complete write-side audit (FR-D01's "no exceptions" claim,
  checked endpoint-by-endpoint against the ~40 admin routes) and a new read
  path.
- **Alternatives considered**: A separate reporting/analytics store (e.g.
  materialised view or external log system) — rejected; Out of Scope
  explicitly limits schema change to additive columns/indexes for the
  activity surface, and NFR-007's 1s p75 target is achievable from
  PostgreSQL with the right indexes at the stated retention volume (24
  months, admin-only mutation volume, not customer-traffic volume).

## 5. Activity retention/expiry mechanism (FR-D12–FR-D14)

- **Decision**: An Inngest cron-triggered function
  (`src/lib/inngest/functions/activity-retention.ts`), registered in
  `src/lib/inngest/registry.ts` alongside the existing `email-retry.ts` and
  `exchange-rates.ts` functions, that deletes `AdminAuditLog` rows older than
  24 months and reports both successes and failures to operational
  monitoring/logging.
- **Rationale**: The constitution's Scheduled Jobs bullet is unambiguous —
  "There is no `vercel.json` and no cron route segment; scheduling is owned
  entirely by Inngest" — so this is the only compliant mechanism for FR-D13's
  "automated, scheduled process." It mirrors the existing pattern exactly
  (a `functions/*.ts` file with a `cron` trigger, registered once).
- **Alternatives considered**: A Vercel Cron + `app/api/cron/` route —
  explicitly prohibited by the constitution (that route segment does not
  exist and must not be reintroduced). An on-demand check inside the
  activity-read API (delete-on-read) — rejected; it would make deletion a
  side effect of a read request, contradicting FR-D13's requirement that
  expiry is a scheduled process independent of any admin surface, and would
  risk inconsistent/partial cleanup under concurrent reads.

## 6. Bulk-action execution model at scale (NFR-005, Edge Cases)

- **Decision**: Reuse the existing synchronous bulk endpoints
  (`orders/bulk`, `products/bulk`) unchanged for selections at or below a
  documented ceiling; selections above the ceiling (or an explicit "apply to
  entire filtered result set" per FR-A16) must be delivered as a tracked
  background job with observable progress, rather than a single long
  synchronous request. The mechanism for that tracked job is the same
  Inngest event-plus-function pattern already used for deferred work
  (`src/lib/inngest/dispatch.ts` → a registered function), with a
  bulk-operation status record the UI polls or subscribes to for the
  per-row outcome required by FR-A10.
- **Rationale**: NFR-005 explicitly allows either "complete within the
  request budget or be executed as a tracked background job with observable
  progress" and requires the ceiling to be documented and enforced — this is
  an engineering decision the spec deliberately left open. Reusing Inngest
  keeps the mechanism consistent with Principle IV rather than inventing a
  second background-job system.
- **Alternatives considered**: Always executing bulk actions synchronously
  regardless of size — rejected; violates NFR-005 once the selection exceeds
  the request budget, and the Edge Cases explicitly anticipate selections
  spanning more rows than are loaded or exceeding the time budget of a
  single request. A dedicated bulk-job worker outside Inngest — rejected as
  unjustified complexity per Principle VII when Inngest already exists for
  exactly this purpose.

## 7. Command palette and navigation permission-accuracy (FR-E02, FR-E08)

- **Decision**: Extend the existing `CommandPalette` inside
  `AdminNavLinksClient.tsx` (already implemented — fuzzy match over
  `label`/`href`/`keywords`, arrow-key navigation, focus management) so its
  item list is filtered by the current user's permissions before rendering,
  mirroring how the server-rendered `AdminNavLinks` already gates entries.
  Add quick-action entries (not just destinations) as the shared list/form
  surfaces land, gated the same way.
- **Rationale**: A command palette already exists and already satisfies most
  of FR-E08's mechanics (fuzzy search, keyboard operation); the gap is
  permission-accuracy for the _client-side_ item list, since
  `requireAdminPermission` only gates the destination page itself, not
  whether the palette should offer it. This is additive filtering, not a
  new component.
- **Alternatives considered**: Introducing a third-party command-palette
  library (e.g. `cmdk`) — rejected; none is present in the dependency tree,
  and Principle VII requires justifying new dependencies against bundle size
  and maintenance cost when an adequate bespoke implementation already
  exists and works.

## 8. Retired-address redirects (FR-E03, FR-E10)

- **Decision**: Every retired admin page path is replaced by a minimal
  Next.js route (`redirect()` from `next/navigation`, permanent) to its
  survivor, kept indefinitely. `/admin/sales` specifically redirects to
  `/admin` (the dashboard) per FR-E04.
  A small map of `retired → survivor` paths is defined once (e.g. under
  `src/features/admin/services/admin-redirects.ts` or inline per retired
  route) so the mapping is auditable and testable, rather than scattered
  ad-hoc across files.
- **Rationale**: FR-E10 requires these redirects to remain "in place
  indefinitely" — a permanent redirect at the route level is the simplest
  mechanism, avoids middleware complexity, and requires no change to
  `src/proxy.ts` (Out of Scope explicitly excludes changes to the edge
  authorisation gate).
- **Alternatives considered**: Handling redirects in `src/proxy.ts` /
  middleware — rejected; that file's stated purpose is JWT-based admin
  route gating (`getToken`), not content routing, and touching it risks the
  edge-authorisation boundary the spec places Out of Scope.

## 9. Confirmation primitive and typed high-risk confirmation (FR-C01–FR-C07)

- **Decision**: Introduce one new component, `AdminConfirmDialog`, that
  supersedes ad-hoc confirmation call sites and is used everywhere
  `DeleteConfirmModal` is used today plus every other destructive/high-risk
  action (refund, role change, bulk delete). It supports an optional
  "type this value to confirm" mode for the three actions FR-C03 names.
  `DeleteConfirmModal` call sites are migrated to it rather than kept as a
  second, parallel primitive (FR-C01 requires exactly one).
- **Rationale**: `DeleteConfirmModal` already exists as _a_ confirmation
  component per the Baseline, but is "not used by every destructive action,"
  making this an adoption problem with an existing primitive extended for
  the typed-confirmation case, consistent with how the list and form
  surfaces are being extended rather than replaced.
- **Alternatives considered**: Keeping `DeleteConfirmModal` for deletes and
  adding a second component for typed-confirmation actions — rejected; FR-C01
  mandates a single confirmation primitive for every destructive, irreversible,
  or high-consequence action, and SC-004 measures 100% routing through _one_
  shared primitive.

## 10. Dashboard actionable queues (FR-G01–FR-G07)

- **Decision**: Rebuild `/admin` (`src/app/admin/page.tsx`) so its primary
  content is a set of `Actionable queue` cards (orders awaiting action,
  stock below threshold, failed customer emails, reviews awaiting
  moderation, refunds in progress), each independently fetched and rendered
  behind its own `Suspense` boundary so one queue's failure does not block
  the others (FR-G06), with existing analytics figures relocated (not
  recomputed, per the spec's Assumptions) to a secondary, `analytics:read`
  gated section.
- **Rationale**: Per-queue `Suspense` boundaries are the direct mechanism
  for FR-G06's "fail in isolation" requirement under the Cache Components
  model this project already uses (Constitution Principle IV — per-request
  regions behind `Suspense` with skeleton fallback). Each queue maps to an
  existing resource + filter (the `Actionable queue` key entity), so no new
  data source is invented — only a new dashboard composition.
- **Alternatives considered**: A single dashboard data-fetch that returns
  all queue counts together — rejected; one slow or failing query would
  then block every queue, violating FR-G06 directly.

## Summary of resolved unknowns

No `NEEDS CLARIFICATION` markers remain in the Technical Context. Every
decision above is either dictated by the spec's own verified Baseline (which
names the exact files and components to extend) or is a narrow, documented
engineering choice (bulk-job ceiling mechanism, redirect implementation,
retention job shape) consistent with the constitution's existing patterns for
background work, caching, and authorization.
