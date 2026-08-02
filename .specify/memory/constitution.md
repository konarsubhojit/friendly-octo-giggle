<!--
  Sync Impact Report
  ==================
  Version change: 1.2.0 → 2.0.0
  Bump rationale: MAJOR — an existing principle is redefined in a
    backward-incompatible way. Principle IV previously mandated ISR
    via route segment `revalidate`; it now mandates the Next.js
    Cache Components model and prohibits route segment config
    outright. Code that complied with the previous rule is
    non-compliant under the new one, which is the governance
    definition of a MAJOR change.
  Modified principles:
    - IV. Serverless & Caching Architecture — replaced the
      ISR/`revalidate` mandate with the Cache Components mandate
      (`"use cache"` + `cacheLife` + `cacheTag`, per-request by
      default, `Suspense` around per-request regions, no session
      or request-scoped reads inside a cached scope). Prohibited
      `export const dynamic`, `revalidate`, and `runtime`.
      Clarified that Redis and Cache Components are alternatives
      rather than layers, and that writes MUST invalidate both
      Redis and cache tags, with tag failures logged and
      non-fatal.
    - VI. Observability & Structured Logging — added the
      requirement that framework control-flow errors be re-thrown
      via `unstable_rethrow` before logging or response
      conversion, so prerender bail-out signals are never
      reported or served as failures.
  Added sections:
    - Technology & Architecture Constraints → Framework bullet
      now names Cache Components, the shared `cacheLife` profiles
      in `next.config.ts`, and `lib/cache-tags.ts`.
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ aligned
      (Constitution Check section references constitution
      generically)
    - .specify/templates/spec-template.md — ✅ aligned (no
      constitution-specific references)
    - .specify/templates/tasks-template.md — ✅ aligned
    - .specify/templates/checklist-template.md — ✅ aligned
  Follow-up TODOs:
    - None. Feature `012-cache-components-and-ppr` landed the
      migration that brings the codebase into compliance with the
      amended Principle IV: `cacheComponents: true` is enabled,
      every `dynamic` / `revalidate` / `runtime` segment export
      has been removed, public catalog reads use `"use cache"`
      with named `cacheLife` profiles and `cacheTag` values from
      `lib/cache-tags.ts`, and writes invalidate both Redis and
      cache tags with tag failures logged and non-fatal.
      `docs/architecture.md` and `docs/development.md` were
      updated in the same change set (Governance step 3).
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
data) MUST be validated with Zod schemas defined in
`lib/validations.ts`. Database queries MUST use Drizzle ORM's
typed API — raw SQL is prohibited except inside Drizzle migrations.
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

Redis via `getCachedData` from `lib/redis.ts` remains the
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

Deferred background jobs (email, webhooks) MUST use QStash via
`lib/qstash.ts` rather than in-process execution. Runtime
configuration that is read often but changes rarely (feature
flags, shipping rates) MUST use Vercel Edge Config via
`lib/edge-config.ts` for sub-millisecond reads — with hardcoded
defaults as fallback when `EDGE_CONFIG` is unavailable.
Scheduled recurring tasks (email retries, rate refresh) MUST
use Vercel Cron Jobs configured in `vercel.json`.

### V. Security by Default

All user input MUST be validated and sanitized before processing.
Database queries MUST use parameterized statements (enforced by
Drizzle ORM). Sensitive routes MUST check authentication via
`auth()` from `lib/auth.ts` and enforce RBAC (CUSTOMER / ADMIN).
Admin routes MUST use the shared `checkAdminAuth()` from
`lib/admin-auth.ts` — inline auth checks in individual route
files are prohibited. Cron job endpoints (`app/api/cron/`) MUST
verify requests via `CRON_SECRET` bearer token when the env var
is set, falling back to `vercel-cron` user-agent validation.
API routes MUST return `401` for
unauthenticated and `403` for unauthorized access. Secrets MUST
reside in `.env.local` and MUST NOT be committed. HTTPS MUST be
enforced in production. All components MUST follow OWASP Top 10
mitigations.

### VI. Observability & Structured Logging

All API routes MUST use the `withApiLogging` middleware from
`lib/api-middleware.ts` to capture request ID, timing, and user
context. Logging MUST use Pino via `lib/logger.ts` (structured
JSON in production, pretty-print in development). `LOG_LEVEL`
MUST be `info` or higher in production. Error responses MUST use
`handleApiError` from `lib/api-utils.ts` to ensure consistent
error shape and logging. Framework control-flow errors (prerender
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
patterns, error handling) MUST be extracted into `lib/` modules
and imported — not duplicated across route files. When the same
logic appears in three or more files, it MUST be refactored into
a shared utility. New shared modules MUST NOT introduce import
chains that pull heavy dependencies (e.g., `next-auth`) into
lightweight utility files (e.g., `api-utils.ts`); use separate
files to isolate dependency graphs.

## Technology & Architecture Constraints

- **Framework**: Next.js 16 with App Router (`app/` directory).
  Legacy `pages/` directory MUST NOT be used. Cache Components
  (`cacheComponents: true` in `next.config.ts`) is the rendering
  model; shared `cacheLife` profiles are declared there and cache
  tag helpers live in `lib/cache-tags.ts`.
- **Database**: PostgreSQL via Neon Serverless, accessed only
  through Drizzle ORM (`lib/db.ts`). Schema changes MUST generate
  a Drizzle migration (`npm run db:generate`) — direct DB
  modification is prohibited.
- **IDs**: Base62 7-character short IDs via `lib/short-id.ts`
  (`varchar(7)` in DB) for products, orders, carts, and related
  entities.
- **State Management**: Redux Toolkit for cross-page shared state
  (cart, orders, admin). Local `useState` for UI-only state.
- **Currency**: Prices stored in USD. Display conversion via
  `useCurrency()` from `CurrencyContext`. Raw `$` or `.toFixed(2)`
  MUST NOT appear in UI code.
- **Styling**: Tailwind CSS v4 utility classes. Custom CSS MUST be
  limited to `globals.css` and CSS variables.
- **Image Storage**: Vercel Blob for uploaded product images.
- **Authentication**: NextAuth.js v5 with Google OAuth +
  email/password + phone/password, DrizzleAdapter, database
  sessions.
- **Search**: Upstash Search (`lib/search.ts`) for AI-powered
  full-text search on products and orders, with automatic DB
  fallback via `lib/search-service.ts` when Upstash is
  unavailable. Search index updates MUST happen on write
  operations.
- **Background Jobs**: QStash (`lib/qstash.ts`) for reliable
  deferred execution (email delivery, webhook dispatch). Event
  types defined in `lib/qstash-events.ts`. Service endpoints
  under `app/api/services/`.
- **Admin Auth**: Centralized in `lib/admin-auth.ts`. All admin
  API routes MUST import `checkAdminAuth` from this module.
- **Edge Config**: Vercel Edge Config via `lib/edge-config.ts`
  for feature flags (`featureFlags`) and shipping configuration
  (`shippingConfig`). All reads MUST fall back to hardcoded
  defaults when `EDGE_CONFIG` env var is absent. Edge Config
  MUST NOT be used for frequently-changing data (use Redis
  instead).
- **Cron Jobs**: Scheduled tasks configured in `vercel.json`.
  Cron routes live under `app/api/cron/` and MUST validate
  `CRON_SECRET` or `vercel-cron` user-agent. Current schedules:
  email retry (every 15 min), exchange rate refresh (every 6 hrs).
- **Accessibility**: Semantic HTML, ARIA attributes (`aria-expanded`,
  `role="menu"`, `aria-haspopup`), and `rel="noopener noreferrer"`
  on external links are mandatory on all interactive components.

## Development Workflow & Quality Gates

1. **Branch & Develop**: Work on a feature branch. Follow the
   file structure conventions in `copilot-instructions.md`.
2. **Lint**: `npm run lint` MUST pass (ESLint flat config).
3. **Type Check**: `npx tsc --noEmit` MUST report zero errors.
4. **Unit Tests**: `npm run test` MUST pass. New/changed logic
   MUST have corresponding tests.
5. **Playwright Verification**: UI changes MUST be verified with
   Playwright and screenshots captured.
6. **Schema Changes**: `npm run db:generate` → review SQL →
   `npm run db:migrate` → test → commit both schema and migration.
7. **Security Scan**: Modified files MUST be analyzed with
   SonarQube (`sonarqube_analyze_file`). Blocker/Critical issues
   MUST be resolved before merge.
8. **API Conventions**: Use `apiSuccess`/`apiError` from
   `lib/api-utils.ts`. Validate with Zod. Return proper HTTP
   status codes.

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

**Version**: 2.0.0 | **Ratified**: 2026-03-19 | **Last Amended**: 2026-08-01
