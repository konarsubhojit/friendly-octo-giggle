# Implementation Plan: Admin Console Revamp

**Branch**: `024-admin-console-revamp` | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-admin-console-revamp/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Unify the presentation layer of the 15 `/admin/*` screens and ~40 `/api/admin/*`
routes around three shared, declarative surfaces — list, form, and confirmation —
and make the existing, currently-unreadable `AdminAuditLog` table visible through
an activity panel per entity and a global activity view. No permission model,
business logic, or API contract changes; this is an incremental, resource-by-resource
UI/architecture migration built on the `004-zenput-admin-integration` foundation
(`AdminDataView` over `zenput`'s `DataTable`/`Pagination`/`SkeletonCard`, plus
`AdminPageShell`, `AdminBreadcrumbs`, `AdminNavLinks`/`AdminNavLinksClient`, and
`DeleteConfirmModal`). The technical approach is: (1) extend `AdminDataView` in
place with row selection, a bulk-action toolbar, filter chips, sort indicators,
URL-reflected query state, and four distinct list states, rather than building a
new component; (2) add a `resource list definition` per admin resource consumed by
the extended `AdminDataView`; (3) add a `saved-view` table and API, owner-scoped
with a built-in shared set; (4) add nullable, additive columns/indexes to
`AdminAuditLog` for actor/role denormalisation and filtering, an activity read API,
an `ActivityPanel` component, and a `/admin/activity` global view; (5) add an
Inngest cron function that hard-deletes activity entries past the 24-month
retention window; (6) regroup navigation, retire `/admin/sales`, and add permanent
redirects for every retired address; (7) convert screens one at a time behind the
existing per-request `requireAdminPermission`/`checkAdminAuth` gates, with each
conversion replacing its predecessor atomically (no dual implementation, no
runtime toggle).

## Technical Context

**Language/Version**: TypeScript 6.0.3 with `strict: true`
**Primary Dependencies**: Next.js ^16.3.0 (App Router, Cache Components), React
^19.2.7, `zenput` ^1.1.2 (`DataTable`, `Pagination`, `SkeletonCard`, form inputs),
Redux Toolkit ^2.12.0, Drizzle ORM ^0.45.2, Zod 4.4.3, Inngest ^4.13.0,
`@upstash/redis` (via `src/lib/redis.ts`), Vercel Edge Config (via
`src/lib/edge-config.ts`)
**Storage**: PostgreSQL via Neon Serverless, accessed only through Drizzle ORM.
Extends the existing `AdminAuditLog` table additively (new nullable/indexed
columns only) and adds one new table for saved views (`AdminSavedView`, or
equivalent name) plus its indexes. No destructive migration.
**Testing**: Vitest ^4.1.7 + React Testing Library (unit, co-located under
`__tests__/` mirroring `src/`); Playwright ^1.62.0 for UI/UX verification with
screenshot evidence, extending the existing `playwright-tests/admin-views.spec.ts`
and `playwright-tests/ux-audit.spec.ts` suites; an automated coverage check (per
SC-005/NFR-006) asserting every mutating `src/app/api/admin/**/route.ts` handler
calls `recordAdminAuditLog`.
**Target Platform**: Next.js App Router (`src/app/`) deployed as Vercel serverless
functions; admin pages are server components per-request (`await connection()` +
`requireAdminPermission`), matching the platform's Cache Components model.
**Project Type**: Web application, single Next.js project — this feature is
entirely within the existing `src/app/admin/`, `src/app/api/admin/`, and
`src/features/admin/` trees; no new project or package is introduced.
**Performance Goals**: List screens render meaningful content within 1s p75
(NFR-001); search/filter/sort/page changes resolve within 1s p75 with an
in-progress indicator within 100ms (NFR-002); any interaction responds within
200ms (NFR-003); lists stay responsive against 100k+ underlying rows via existing
cursor pagination, never client-side paging (NFR-004); the global activity view
returns its first page within 1s p75 against a full 24-month retention window
(NFR-007).
**Constraints**: No increase in database round trips for any existing screen
(NFR-009); no weakening of server-side authorization — `checkAdminAuth` /
`requireAdminPermission` remain the sole and authoritative gates, the interface
only mirrors their outcome (NFR-010); no route-segment configuration
(`dynamic`, `revalidate`, `runtime` exports), since Cache Components forbids it
(FR-F04); bulk actions beyond a documented synchronous selection-size ceiling
must become a tracked background job rather than exceed the request budget
(NFR-005); WCAG 2.1 AA with zero automated violations in both themes (NFR-008);
usable at 375px wide with no horizontal page scroll (FR-H06); English-only, no
i18n; incremental resource-by-resource rollout with no dual-implementation period
per screen (FR-I01–FR-I04).
**Scale/Scope**: 15 admin pages under `src/app/admin/`, ~40 API routes under
`src/app/api/admin/`, 12 permission strings across 4 roles, 4 existing
`AdminDataView` consumers to extend in place plus 7 screens (categories, coupons,
reviews, returns, checkout-requests, recommendations, email-failures already
partially covered) to convert onto it, one new global activity view, one new
saved-views store, one retired screen (`/admin/sales`) with a permanent redirect,
and one new scheduled Inngest function for activity retention.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                                                            | Status  | Notes                                                                                                                                                                                                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Server-First Rendering                                                | ✅ PASS | All 15 admin pages already default to server components with per-request `await connection()` + `requireAdminPermission`, which already satisfies FR-F03/FR-F04. New interactive pieces (row selection, bulk toolbar, saved-view picker, command palette additions, activity filters) are `'use client'` islands mirroring the existing `AdminDataView`/`AdminNavLinksClient` pattern — no server logic moves to the client.                                        |
| II   | Type Safety End-to-End                                                | ✅ PASS | New runtime boundaries — the activity list/filter API, saved-view CRUD API, and bulk-action request bodies — are validated with Zod schemas added under `src/lib/validations/`. All Drizzle access for the new `AdminSavedView` table and the extended `AdminAuditLog` columns uses the typed Drizzle API; no raw SQL.                                                                                                                                       |
| III  | Testing Discipline                                                    | ✅ PASS | Unit tests for the extended `AdminDataView`, new `ActivityPanel`, saved-view hooks, and Redux slices are added under `__tests__/` mirroring source paths. Every converted screen and the new activity/saved-view surfaces are verified with Playwright plus screenshots, extending `admin-views.spec.ts`. The audit-coverage check (SC-005) is itself a Vitest/static-analysis test that must not regress.                                                  |
| IV   | Serverless & Caching Architecture                                     | ✅ PASS | No in-memory state persists across requests. Admin screens remain per-request (no `"use cache"` on permission-sensitive data, satisfying FR-F03). The one new background need — scheduled hard-deletion of activity entries past 24 months (FR-D13) — is delivered as an Inngest cron function registered in `src/lib/inngest/registry.ts`, consistent with the existing scheduled-jobs pattern (email retry, exchange-rate refresh), not a bespoke cron route. |
| V    | Security by Default                                                   | ✅ PASS | Every admin page continues to use `requireAdminPermission` from `admin-page-auth.ts`; every route continues to use `checkAdminAuth` from `admin-auth.ts`. No new permission strings are added (FR-C04/FR-C05 self-demotion and last-administrator guards are enforced server-side, reusing `system:manage` for activity-view access per the spec's Assumptions). The interface's rendering of permitted actions is advisory only — NFR-010 requires the server check to remain authoritative regardless.                                        |
| VI   | Observability & Structured Logging                                    | ✅ PASS | New API routes (activity list, saved-view CRUD, bulk-action orchestration where it becomes a tracked job) use `withApiLogging`, `handleApiError`, and `logger` exactly as existing admin routes do. Audit-write failures (FR-D10) are reported to logging/monitoring without failing the originating mutation, matching the existing `recordAdminAuditLog` fire-and-forget shape extended with a caught/logged failure path.                                    |
| VII  | Simplicity & YAGNI                                                     | ✅ PASS | No new component library or data-fetching layer is introduced. The shared list/form/confirmation surfaces are extensions of existing primitives (`AdminDataView`, the form-modal/dedicated-screen split already in use, `DeleteConfirmModal`), matching the spec's explicit Assumption that this is adoption plus capability, not invention.                                                                                                                 |
| VIII | DRY Shared Utilities                                                  | ✅ PASS | Resource list definitions, the activity change-set renderer, and the typed-confirmation primitive are each written once and imported by every consuming screen/route, rather than duplicated per resource — directly addressing FR-A02, FR-D03, and FR-C01's "single definition" requirements.                                                                                                                                                                |

**Post-Design Re-check**: Re-evaluate Principle II (Zod shapes for the activity
change-set and saved-view criteria, and the resource-list-definition type) and
Principle IV (confirming the retention-expiry Inngest function needs no new
scheduling primitive) after Phase 1 design. No violations identified; Complexity
Tracking is not populated.

## Project Structure

### Documentation (this feature)

```text
specs/024-admin-console-revamp/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md         # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── resource-list-definition.md
│   ├── activity-api.md
│   ├── saved-views-api.md
│   └── confirmation-primitive.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx                  # existing shell — nav grouping updated (FR-E01/E05)
│   │   ├── page.tsx                    # dashboard — rebuilt around actionable queues (FR-G01–G07)
│   │   ├── activity/                   # NEW — global activity view (FR-D04/D05)
│   │   │   └── page.tsx
│   │   ├── sales/
│   │   │   └── page.tsx                # retired — becomes a redirect to /admin (FR-E04)
│   │   ├── categories/ coupons/ reviews/ returns/
│   │   │   checkout-requests/ recommendations/ email-failures/
│   │   │   orders/ products/ users/ search/
│   │   │       page.tsx                # converted onto extended AdminDataView, one resource at a time (FR-I01–I03)
│   │   └── [retired-slug]/route.ts     # permanent redirects for every retired address (FR-E10)
│   └── api/
│       └── admin/
│           ├── activity/                # NEW — global + per-entity activity read API (FR-D04/D06)
│           │   └── route.ts
│           ├── saved-views/              # NEW — owner-scoped saved-view CRUD (FR-A17–A21)
│           │   ├── route.ts
│           │   └── [id]/route.ts
│           ├── orders/bulk/ products/bulk/  # existing — consumed by the new bulk toolbar, unmodified contract
│           └── export/ import/              # existing — surfaced by the new export/import UI, unmodified contract
├── features/
│   └── admin/
│       ├── components/
│       │   ├── AdminDataView.tsx        # EXTENDED — selection, bulk toolbar, filter chips, sort, URL state, 4 list states
│       │   ├── AdminBulkActionBar.tsx   # NEW
│       │   ├── AdminSavedViewPicker.tsx # NEW
│       │   ├── AdminActivityPanel.tsx   # NEW — per-entity activity (FR-D06)
│       │   ├── AdminActivityFilters.tsx # NEW — global view filters (FR-D05)
│       │   ├── AdminConfirmDialog.tsx   # NEW — single confirmation primitive, typed-confirmation variant (FR-C01–C03)
│       │   ├── AdminNavLinksClient.tsx  # EXTENDED — command palette reach + permission-accurate nav (FR-E02/E08)
│       │   └── DeleteConfirmModal.tsx   # superseded by AdminConfirmDialog; call sites migrated, not duplicated
│       ├── hooks/
│       │   ├── useAdminListState.ts     # NEW — URL-reflected search/filter/sort/page state (FR-A07)
│       │   └── useSavedViews.ts         # NEW
│       └── services/
│           ├── admin-audit-log.ts       # EXTENDED — role/actor capture already present; adds read-side query helpers
│           ├── admin-activity-retention.ts # NEW — 24-month expiry logic invoked by the Inngest function
│           └── admin-auth.ts / admin-page-auth.ts  # UNCHANGED — remain the sole authorization boundary
├── lib/
│   ├── inngest/functions/
│   │   └── activity-retention.ts        # NEW — scheduled hard-delete of entries older than 24 months (FR-D13)
│   ├── schema.ts                        # EXTENDED — additive AdminAuditLog columns/indexes + new AdminSavedView table
│   └── validations/
│       └── admin.ts                     # NEW or extended — Zod schemas for activity queries, saved-view criteria, bulk requests
└── components/ (shared, unaffected)

__tests__/
├── features/admin/components/ ...       # unit tests mirroring new/extended components
├── features/admin/services/ ...         # unit tests for retention + audit read helpers
└── lib/inngest/functions/ ...           # unit test for the retention function

playwright-tests/
├── admin-views.spec.ts                  # EXTENDED — per-resource conversion coverage
└── ux-audit.spec.ts                     # EXTENDED — accessibility sweep across converted screens
```

**Structure Decision**: Single Next.js project (Option 1, single project — no
frontend/backend split exists or is introduced). All work lives inside the
existing `src/app/admin/`, `src/app/api/admin/`, and `src/features/admin/` trees
plus one new Inngest function and one additive schema change in `src/lib/`. No
new top-level directory, package, or service boundary is created, consistent
with the spec's Out of Scope statement that the data access layer, shared state
library, and admin component library are not being replaced.

## Complexity Tracking

> No Constitution Check violations were identified; this section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------- |
| None      | —          | —                                      |
