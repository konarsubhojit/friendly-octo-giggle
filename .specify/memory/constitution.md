<!--
  Sync Impact Report
  ==================
  Version change: 0.0.0 (blank template) → 1.0.0
  Modified principles: N/A (initial population)
  Added sections:
    - Core Principles (7 principles)
    - Technology & Architecture Constraints
    - Development Workflow & Quality Gates
    - Governance
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ aligned (Constitution Check
      section already references constitution file generically)
    - .specify/templates/spec-template.md — ✅ aligned (no constitution-
      specific references need updating)
    - .specify/templates/tasks-template.md — ✅ aligned (phase structure
      compatible with principles)
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
across requests. Frequently-read data MUST be cached via Redis
using `getCachedData` from `lib/redis.ts` with stampede prevention
and stale-while-revalidate. Cache MUST be invalidated on writes
via `invalidateCache`. API responses MUST include appropriate
`Cache-Control` headers. Static pages MUST use ISR with
`revalidate` instead of `force-dynamic` where possible.

### V. Security by Default

All user input MUST be validated and sanitized before processing.
Database queries MUST use parameterized statements (enforced by
Drizzle ORM). Sensitive routes MUST check authentication via
`auth()` from `lib/auth.ts` and enforce RBAC (CUSTOMER / ADMIN).
API routes MUST return `401` for unauthenticated and `403` for
unauthorized access. Secrets MUST reside in `.env.local` and MUST
NOT be committed. HTTPS MUST be enforced in production. All
components MUST follow OWASP Top 10 mitigations.

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

**Version**: 1.0.0 | **Ratified**: 2026-03-19 | **Last Amended**: 2026-03-19
