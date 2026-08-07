<!--
  Sync Impact Report
  ==================
  Version change: 2.0.0 → 3.0.0
  Bump rationale: MAJOR — Principle IV's background-jobs mandate is
    replaced wholesale. The previous rule required QStash via
    `lib/qstash.ts` with service endpoints under `app/api/services/`
    and Vercel Cron Jobs configured in `vercel.json`. None of those
    modules, routes, or files exist in the repository; background
    work runs on Inngest. Replacing a mandate with a different
    mandate makes previously-compliant code non-compliant, which
    Governance clause 2 defines as MAJOR.
  Modified principles:
    - II. Type Safety End-to-End — Zod schemas relocated from the
      nonexistent `lib/validations.ts` to `src/lib/validations/`
      (`index.ts`, `api.ts`, `env.ts`, `payment.ts`,
      `primitives.ts`).
    - IV. Serverless & Caching Architecture — QStash, service
      endpoints under `app/api/services/`, and Vercel Cron in
      `vercel.json` replaced by Inngest durable functions
      (`src/lib/inngest/client.ts`, `dispatch.ts`, `registry.ts`)
      with cron triggers declared on the functions in
      `src/lib/inngest/functions/`. Redis path corrected to
      `src/lib/redis.ts`, Edge Config to `src/lib/edge-config.ts`.
    - V. Security by Default — `checkAdminAuth()` repointed from
      the nonexistent `lib/admin-auth.ts` to
      `src/features/admin/services/admin-auth.ts`, with
      `admin-page-auth.ts` named for pages. The `CRON_SECRET` /
      `vercel-cron` clause for `app/api/cron/` is removed because
      that route segment does not exist; the signed `/api/inngest`
      route is now the stated authenticity boundary for background
      work. `auth()` corrected to `src/lib/auth.ts`.
    - VI. Observability & Structured Logging — `withApiLogging`,
      Pino, and `handleApiError` repointed to
      `src/lib/api-middleware.ts`, `src/lib/logger.ts`, and
      `src/lib/api-utils.ts`.
    - VIII. DRY Shared Utilities — `lib/` corrected to `src/lib/`,
      with domain-specific concerns allowed to live in the owning
      `src/features/<domain>/` module, matching the actual layout.
  Modified sections:
    - Technology & Architecture Constraints — added a Source
      Layout bullet naming `src/app`, `src/features` (nine
      modules), `src/lib`, and `src/components`. Currency
      corrected from USD to INR as the storage base, matching
      `src/lib/currency.ts` where INR has rate `1` and
      `formatPrice` takes `priceInINR`. Authentication corrected
      from database sessions to JWT sessions, matching
      `session.strategy: 'jwt'` in `src/lib/auth.config.ts` and
      the `getToken` read in `src/proxy.ts`. Search repointed from
      `lib/search.ts` / `lib/search-service.ts` to
      `src/lib/search/`. Background Jobs rewritten for Inngest.
      Cron Jobs replaced by a Scheduled Jobs bullet recording the
      two real Inngest cron triggers and the absence of
      `vercel.json`. Image Storage now names both the Vercel Blob
      and Azure Blob providers selected in
      `src/lib/image-storage.ts`. All remaining `lib/*` paths
      prefixed with `src/`.
    - Development Workflow & Quality Gates — type check corrected
      to `npx tsc --noEmit -p tsconfig.check.json` (the project's
      actual check config, as run in `.github/workflows/build.yml`),
      schema-change step extended to refresh
      `scripts/sql/bootstrap-drizzle-initial.sql`, and a new gate 9
      added for `npm run docs:check`.
  Added sections: None
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ aligned
      (Constitution Check section references the constitution
      generically)
    - .specify/templates/spec-template.md — ✅ aligned
    - .specify/templates/tasks-template.md — ✅ aligned
    - .specify/templates/checklist-template.md — ✅ aligned
  Follow-up TODOs:
    - None. This amendment is a correction of drift, not a change
      of engineering intent: every clause is a one-for-one
      replacement of a module that does not exist with the module
      that performs its function today. The codebase is already
      compliant with every amended clause, which is why the
      amendment was necessary. Landed as feature
      `014-documentation-and-instruction-reconciliation`, which
      also corrected `README.md`, `docs/`, and
      `.github/copilot-instructions.md` in the same change set
      (Governance step 3).
-->

# The Kiyon Store Constitution

## Core Principles

### I. Server-First Rendering

All pages and components MUST default to React Server Components.
The `'use client'` directive MUST only be added when a component
requires hooks, browser APIs, or interactive state. Client Components
MUST NOT use `next/dynamic` with `{ ssr: false }` inside Server
Components. Heavy data fetching and business logic MUST remain on
the server to minimize client bundle size.

### II. Type Safety End-to-End (NON-NEGOTIABLE)

All code MUST be written in strict TypeScript (`strict: true`).
Runtime input boundaries (API routes, form submissions, external
data) MUST be validated with Zod schemas defined under
`src/lib/validations/` (`index.ts`, `api.ts`, `env.ts`,
`payment.ts`, `primitives.ts`). Database queries MUST use Drizzle
ORM's typed API — raw SQL is prohibited except inside Drizzle
migrations.
Prefer type inference where the type is obvious; use explicit types
for public API surfaces and shared interfaces.

### III. Testing Discipline

Unit tests MUST exist for all shared utilities, Redux slices,
validation schemas, and reusable components (co-located under
`__tests__/` mirroring the source path). Tests MUST use Vitest
with jsdom + React Testing Library. UI/UX changes MUST be verified
with Playwright before completion, including screenshot evidence
on modified pages. New features MUST NOT decrease existing test
coverage.

### IV. Serverless & Caching Architecture

The application MUST remain deployable as serverless on-demand
functions (Vercel/AWS Lambda). No in-memory state may persist
across requests. Background work (e.g., stale-while-revalidate
cache refresh) MUST use `void (async () => { ... })()` — never
`setImmediate` or `setTimeout`, as those are not guaranteed to
complete in serverless runtimes.

Rendering MUST follow the Next.js Cache Components model:
everything is per-request by default, and cacheable work is
opted in by wrapping it in a `"use cache"` scope that declares
an explicit `cacheLife` profile and `cacheTag` set. Route
segment configuration (`export const dynamic`, `revalidate`,
`runtime`) MUST NOT be used — Next.js rejects it once Cache
Components is enabled. Per-request regions of an otherwise
prerenderable page MUST sit behind a `Suspense` boundary with a
skeleton fallback. A `"use cache"` scope MUST NOT read sessions,
cookies, headers, or any request-scoped state.

Redis via `getCachedData` from `src/lib/redis.ts` remains the
cross-request cache for work Cache Components cannot cover
(session-scoped reads and route handlers serving authenticated
data), with stampede prevention and stale-while-revalidate. A
Redis read MUST NOT be nested inside a `"use cache"` scope —
the two layers are alternatives, never stacked. Writes MUST
invalidate every layer they affect: `invalidateCache` for Redis
and `revalidateTag` for each affected cache tag. Tag
revalidation failures MUST be logged and MUST NOT fail the
originating write. API responses MUST include appropriate
`Cache-Control` headers.

Deferred background jobs (email delivery, order side effects,
webhook dispatch) MUST use Inngest durable functions rather than
in-process execution. Events are published through
`src/lib/inngest/dispatch.ts` using the client in
`src/lib/inngest/client.ts`; every function MUST be registered in
`src/lib/inngest/registry.ts`, which is the single list the
`/api/inngest` route serves. Runtime configuration that is read
often but changes rarely (feature flags, shipping rates) MUST use
Vercel Edge Config via `src/lib/edge-config.ts` for
sub-millisecond reads — with hardcoded defaults as fallback when
`EDGE_CONFIG` is unavailable. Scheduled recurring tasks (email
retries, exchange-rate refresh) MUST use Inngest cron triggers
declared on the functions in `src/lib/inngest/functions/`.

### V. Security by Default

All user input MUST be validated and sanitized before processing.
Database queries MUST use parameterized statements (enforced by
Drizzle ORM). Sensitive routes MUST check authentication via
`auth()` from `src/lib/auth.ts` and enforce RBAC (CUSTOMER /
ADMIN). Admin API routes MUST use the shared `checkAdminAuth()`
from `src/features/admin/services/admin-auth.ts`, and admin pages
MUST use `src/features/admin/services/admin-page-auth.ts` —
inline auth checks in individual route files are prohibited.
Inngest handlers MUST be reached only through the signed
`/api/inngest` route, whose signature verification is the
authenticity boundary for all background work. API routes MUST
return `401` for unauthenticated and `403` for unauthorized
access. Secrets MUST reside in `.env.local` and MUST NOT be
committed. HTTPS MUST be enforced in production. All components
MUST follow OWASP Top 10 mitigations.

### VI. Observability & Structured Logging

All API routes MUST use the `withApiLogging` middleware from
`src/lib/api-middleware.ts` to capture request ID, timing, and
user context. Logging MUST use Pino via `src/lib/logger.ts`
(structured JSON in production, pretty-print in development).
`LOG_LEVEL` MUST be `info` or higher in production. Error
responses MUST use `handleApiError` from `src/lib/api-utils.ts`
to ensure consistent error shape and logging. Framework
control-flow errors (prerender
bail-out signals, `redirect`, `notFound`) MUST be re-thrown via
`unstable_rethrow` before any error is logged or converted into a
response, so caching and navigation signals are never reported or
served as failures.

### VII. Simplicity & YAGNI

Features MUST solve the current requirement — no speculative
abstractions, premature generalizations, or extra configurability.
New dependencies MUST be justified against bundle size impact and
maintenance cost. Each component MUST have a single, clear
responsibility. Complexity MUST be explicitly justified in PRs
when it exceeds straightforward implementation.

### VIII. DRY Shared Utilities

Cross-cutting concerns (admin auth, serialization, cache
patterns, error handling) MUST be extracted into `src/lib/`
modules, or into the owning module's `src/features/<domain>/`
directory when the concern is domain-specific, and imported —
not duplicated across route files. When the same
logic appears in three or more files, it MUST be refactored into
a shared utility. New shared modules MUST NOT introduce import
chains that pull heavy dependencies (e.g., `next-auth`) into
lightweight utility files (e.g., `api-utils.ts`); use separate
files to isolate dependency graphs.

## Technology & Architecture Constraints

- **Framework**: Next.js 16 with App Router (`src/app/`
  directory). Legacy `pages/` directory MUST NOT be used. Cache
  Components (`cacheComponents: true` in `next.config.ts`) is the
  rendering model; shared `cacheLife` profiles are declared there
  and cache tag helpers live in `src/lib/cache-tags.ts`.
- **Source Layout**: All application code lives under `src/`:
  routes in `src/app/`, domain modules in `src/features/`
  (`account`, `admin`, `ai`, `auth`, `cart`, `orders`,
  `payments`, `product`, `wishlist`), shared utilities in
  `src/lib/`, and presentational components in `src/components/`.
- **Database**: PostgreSQL via Neon Serverless, accessed only
  through Drizzle ORM (`src/lib/db.ts`). Schema changes MUST
  generate a Drizzle migration (`npm run db:generate`) — direct DB
  modification is prohibited. `npm run db:bootstrap` applies the
  full current schema idempotently to an empty or partially
  migrated database.
- **IDs**: Base62 7-character short IDs via `src/lib/short-id.ts`
  (`varchar(7)` in DB) for products, orders, carts, and related
  entities.
- **State Management**: Redux Toolkit for cross-page shared state
  (cart, orders, admin). Local `useState` for UI-only state.
- **Currency**: Prices are stored in INR, which is the base
  currency with rate `1` in `src/lib/currency.ts`. Display
  conversion via `useCurrency()` from `CurrencyContext`, whose
  `formatPrice` takes a price in INR. Raw `$` or `.toFixed(2)`
  MUST NOT appear in UI code.
- **Styling**: Tailwind CSS v4 utility classes. Custom CSS MUST be
  limited to `src/app/globals.css` and CSS variables.
- **Image Storage**: Vercel Blob or Azure Blob Storage for
  uploaded product images, selected through
  `src/lib/image-storage.ts`.
- **Authentication**: NextAuth.js v5 with Google OAuth +
  email/password + phone/password, DrizzleAdapter, and JWT
  sessions (`session.strategy: 'jwt'` in
  `src/lib/auth.config.ts`). `src/proxy.ts` gates admin routes by
  reading the JWT with `getToken` from `next-auth/jwt` rather
  than `auth()`, to keep the adapter out of the edge bundle.
- **Search**: Upstash Search (`src/lib/search/client.ts`,
  re-exported from `src/lib/search/index.ts`) for full-text
  search on products and orders, with automatic DB fallback via
  `src/lib/search/product-search.ts` when Upstash is unavailable.
  Search index updates MUST happen on write operations.
- **Background Jobs**: Inngest durable functions for reliable
  deferred execution (email delivery, order side effects,
  webhook dispatch). The client lives in
  `src/lib/inngest/client.ts`, events are published through
  `src/lib/inngest/dispatch.ts`, and every function MUST be
  listed in `src/lib/inngest/registry.ts`, which the signed
  `/api/inngest` route serves.
- **Admin Auth**: Centralized in
  `src/features/admin/services/admin-auth.ts`. All admin API
  routes MUST import `checkAdminAuth` from this module; admin
  pages MUST use `requireAdminPermission` from
  `src/features/admin/services/admin-page-auth.ts`.
- **Edge Config**: Vercel Edge Config via
  `src/lib/edge-config.ts` for feature flags (`featureFlags`) and
  shipping configuration (`shippingConfig`). All reads MUST fall
  back to hardcoded defaults when `EDGE_CONFIG` env var is
  absent. Edge Config MUST NOT be used for frequently-changing
  data (use Redis instead).
- **Scheduled Jobs**: Declared as Inngest `cron` triggers on the
  functions in `src/lib/inngest/functions/`. Current schedules:
  failed-email retry (`30 2 * * *`) and exchange-rate refresh
  (`0 3 * * *`). There is no `vercel.json` and no cron route
  segment; scheduling is owned entirely by Inngest.
- **Accessibility**: Semantic HTML, ARIA attributes (`aria-expanded`,
  `role="menu"`, `aria-haspopup`), and `rel="noopener noreferrer"`
  on external links are mandatory on all interactive components.

## Development Workflow & Quality Gates

1. **Branch & Develop**: Work on a feature branch. Follow the
   file structure conventions in
   `.github/copilot-instructions.md`.
2. **Lint**: `npm run lint` MUST pass (ESLint flat config).
3. **Type Check**: `npx tsc --noEmit -p tsconfig.check.json`
   MUST report zero errors.
4. **Unit Tests**: `npm run test` MUST pass. New/changed logic
   MUST have corresponding tests.
5. **Playwright Verification**: UI changes MUST be verified with
   Playwright and screenshots captured.
6. **Schema Changes**: `npm run db:generate` → review SQL →
   `npm run db:migrate` → test → commit both schema and
   migration, and refresh
   `scripts/sql/bootstrap-drizzle-initial.sql` so
   `npm run db:bootstrap` stays current.
7. **Security Scan**: Modified files MUST be analyzed with
   SonarQube (`sonarqube_analyze_file`). Blocker/Critical issues
   MUST be resolved before merge.
8. **API Conventions**: Use `apiSuccess`/`apiError` from
   `src/lib/api-utils.ts`. Validate with Zod. Return proper HTTP
   status codes.
9. **Documentation Drift**: `npm run docs:check` MUST pass. Every
   `npm run <script>` and `.github/workflows/<name>.yml`
   reference in Markdown MUST resolve.

## Governance

This constitution supersedes conflicting practices found in other
project documentation. Amendments require:

1. A documented rationale for the change.
2. An update to this file with version increment (semver:
   MAJOR for principle removals/redefinitions, MINOR for new
   principles/sections, PATCH for clarifications).
3. Propagation of changes to dependent templates under
   `.specify/templates/` and project documentation under `docs/`.
4. All PRs and code reviews MUST verify compliance with these
   principles. Non-compliance MUST be justified explicitly.

Runtime development guidance is maintained in
`.github/copilot-instructions.md` and `docs/development.md`.

**Version**: 3.0.0 | **Ratified**: 2026-03-19 | **Last Amended**: 2026-08-07
