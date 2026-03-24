<!--
  Sync Impact Report
  ==================
  Version change: 1.1.0 → 1.2.0
  Bump rationale: MINOR — new architectural constraints added
    (Edge Config, Vercel Cron Jobs, CRON_SECRET auth pattern),
    no existing principles removed or redefined.
  Modified principles:
    - IV. Serverless & Caching Architecture — expanded to cover
      Edge Config for ultra-low-latency configuration reads and
      Vercel Cron Jobs for scheduled tasks.
    - V. Security by Default — added CRON_SECRET bearer token
      requirement for cron endpoints.
  Added sections:
    - Edge Config (lib/edge-config.ts) in Technology &
      Architecture Constraints for feature flags and shipping
      configuration.
    - Cron Jobs (vercel.json) in Technology & Architecture
      Constraints for scheduled email retries and exchange
      rate refresh.
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ aligned
      (Constitution Check section references constitution
      generically)
    - .specify/templates/spec-template.md — ✅ aligned (no
      constitution-specific references)
    - .specify/templates/tasks-template.md — ✅ aligned (phase
      structure compatible with new constraints)
    - .specify/templates/checklist-template.md — ✅ aligned
  Follow-up TODOs: None
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
complete in serverless runtimes. Frequently-read data MUST be
cached via Redis using `getCachedData` from `lib/redis.ts` with
stampede prevention and stale-while-revalidate. Cache MUST be
invalidated on writes via `invalidateCache`. API responses MUST
include appropriate `Cache-Control` headers. Static pages MUST
use ISR with `revalidate` instead of `force-dynamic` where
possible. Deferred background jobs (email, webhooks) MUST use
QStash via `lib/qstash.ts` rather than in-process execution.
Runtime configuration that is read often but changes rarely
(feature flags, shipping rates) MUST use Vercel Edge Config
via `lib/edge-config.ts` for sub-millisecond reads — with
hardcoded defaults as fallback when `EDGE_CONFIG` is unavailable.
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
error shape and logging.

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
  Legacy `pages/` directory MUST NOT be used.
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

**Version**: 1.2.0 | **Ratified**: 2026-03-19 | **Last Amended**: 2026-03-24
