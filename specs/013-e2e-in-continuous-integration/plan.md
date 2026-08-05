# Implementation Plan: End-to-End Suite in Continuous Integration

**Branch**: `013-e2e-in-continuous-integration` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-e2e-in-continuous-integration/spec.md`

## Summary

The repository declares 18 Playwright projects over 16 spec files and never runs any of them in continuous integration. `.github/workflows/build.yml` has nine jobs and not one invokes Playwright, `package.json` has no `test:e2e` script, and the suite cannot start even locally because `playwright.config.ts:21` probes `/en/shop`, a route deleted with localization. This feature turns the suite into a required status check on every pull request, repairs the assertions that rotted when localization was removed, and provisions the ephemeral database that server-rendered routes need in order to render at all.

Three constraints shape the design, all verified on the runner rather than assumed:

1. `src/lib/db.ts:1-2` reaches Postgres through `@neondatabase/serverless`, which speaks WebSocket to a hosted endpoint. A bare `postgres:16` service container is unreachable, and `src/lib/env.ts:22-28` throws at import time, so this fails at boot before any route renders. Resolved by a `ghcr.io/neondatabase/wsproxy` sidecar plus a CI-only `neonConfig` branch in `src/lib/db.ts` gated on `E2E_WS_PROXY` (research R1-R10).
2. `src/proxy.ts:361-372` returns a 301 to `https://` for every plain-HTTP request outside development, and `next start` cannot serve TLS. Injecting `x-forwarded-proto: https` does not help: Playwright's readiness probe follows the redirect into a dead port, and Next.js then rewrites the three `src/proxy.ts` auth redirects to absolute `https://localhost:3000` locations the browser cannot reach. Resolved by a second CI-only gate, `E2E_ALLOW_INSECURE_HTTP` (research R11-R16).
3. Traces are currently `off` — `playwright.config.ts` sets no `trace` option — so SC-007 cannot be met without enabling `trace: 'retain-on-failure'` (research R20).

The delivered shape is one blocking lane of four shards plus one advisory lane, both hanging off the existing `build` job, merged by a single gate job named **`End-to-End Suite`** that becomes the required status check. A third lane, `e2e-preview-smoke`, runs a read-only subset against the deployed preview after a `develop` push; it is advisory, off the pull-request critical path, and deliberately outside the gate's `needs:`.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node 24 in CI (`.github/workflows/build.yml` `node-version: 24`), Node 22.23.1 locally
**Primary Dependencies**: `@playwright/test` 1.62.0 (pinned by `package-lock.json`), `next` 16 with Cache Components, `drizzle-orm` + `drizzle-kit`, `@neondatabase/serverless` 1.1.0, `bcryptjs`, `next-auth` v5
**Storage**: Ephemeral `postgres:16-alpine` service container, migrated from the committed `drizzle/` files and loaded from a committed seed. No cache service — `src/lib/redis.ts:31-45` returns `null` without the Upstash variables and falls through to the fetcher (research R17)
**Testing**: Playwright for the browser suite; Vitest for the two inertness unit tests that guard the CI-only branches; existing `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` gates unchanged
**Target Platform**: `ubuntu-latest` GitHub-hosted runners (4 vCPU), Chromium only — every project uses `devices['Desktop Chrome']` or `devices['Pixel 5']` (research R21)
**Project Type**: Next.js App Router web application with a Playwright end-to-end suite and a GitHub Actions workflow
**Performance Goals**: End-to-end job within 15 minutes wall clock; total pull-request CI within 30 minutes (spec Q3, FR-011, SC-006)
**Constraints**: No repository secrets in the end-to-end path, so fork pull requests run the identical blocking set (FR-010, SC-008); no production runtime behavior may change (FR-014); no assertion may be weakened to force green (FR-009)
**Scale/Scope**: 230 declared test instances across 16 spec files and 17 live projects, measured with `npx playwright test --list`. After repair: 151 blocking cases over 14 projects, 40 advisory cases over 3 projects, 1 project removed

### Reconciling the measured counts with the spec

The spec's Q3 rationale cites "103 statically written cases across 16 files plus roughly 34 dynamically generated ones". That counts distinct `test()` declarations, not the instances Playwright actually schedules: `accessibility.spec.ts` is declared once and runs in two projects, `admin-views.spec.ts` in two, `ux-audit.spec.ts` in four. The authoritative figure for time budgeting is the instance count, because that is what a shard executes. Both numbers describe the same suite; this plan uses 230 pre-repair and 191 post-repair instances throughout and states the derivation wherever a number appears.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Evaluated against `.specify/memory/constitution.md` v2.0.0. Re-checked after Phase 1 with no change in outcome.

| Principle                              | Verdict            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Server-First Rendering              | Pass               | No rendering strategy changes. The feature runs the deployed rendering path rather than altering it; the ephemeral database exists precisely because Server Components read directly and cannot be mocked at the browser boundary.                                                                                                                                                                                                                                                                                                                                                                        |
| II. Type Safety End-to-End             | Pass               | Both new environment variables (`E2E_WS_PROXY`, `E2E_ALLOW_INSECURE_HTTP`) are declared in `src/lib/validations/env.ts` as optional Zod members and read through the validated `env` object, not raw `process.env`. The seed imports table types from `src/lib/schema.ts`, so a migration that adds a required column breaks the seed at type-check rather than at run time.                                                                                                                                                                                                                              |
| III. Testing Discipline                | Pass               | This is the principle the feature serves. Workflow step 5 already mandates Playwright verification but nothing enforces it — `.github/workflows/build.yml` runs Vitest, Sonar, DeepSource, and Codecov and never invokes Playwright. FR-009 and Decision 8 (`retries: 0`) keep the signal honest rather than trading determinism for green runs.                                                                                                                                                                                                                                                          |
| IV. Serverless & Caching Architecture  | Pass               | The suite runs against `next start` on a production build, which is the only mode that exercises the Cache Components prerender path. `playwright-tests/session-isolation.spec.ts` is in the blocking set, so a personalized response leaking into a prerendered shell fails the pull request. This discharges `specs/012-cache-components-and-ppr/plan.md:316-318` (T045).                                                                                                                                                                                                                               |
| V. Security by Default                 | Pass with a caveat | No repository secret enters the end-to-end path: `DATABASE_URL`, `NEXTAUTH_SECRET`, `COPILOT_DEV_EMAIL`, and `COPILOT_DEV_PASS` are literal non-secret job values on an ephemeral loopback database, extending the precedent `.github/workflows/build.yml` already sets for its `build` job. The caveat is `E2E_ALLOW_INSECURE_HTTP`, which suppresses the `src/proxy.ts` HTTPS redirect for the CI run; it is recorded in Complexity Tracking and its blast radius in the deployed topology is nil, because the edge always sets `x-forwarded-proto: https` and the branch is already unreachable there. |
| VI. Observability & Structured Logging | Pass               | No application logging changes. The seed script lives under `scripts/`, where `eslint.config.js:54-57` does not disable `no-console`, so it carries the `/* eslint-disable no-console */` header both committed scripts already use (research R26).                                                                                                                                                                                                                                                                                                                                                       |
| VII. Simplicity & YAGNI                | Pass with a caveat | Two service containers, one seed script, two environment gates, and two workflow jobs. Three tempting additions were rejected on this principle: a TLS terminator sidecar (removed by research R15), a `ws` package import (removed by research R4 case A), and per-shard manual project pinning (removed by research R19). The caveat is the wsproxy sidecar itself, recorded in Complexity Tracking.                                                                                                                                                                                                    |
| VIII. DRY Shared Utilities             | Pass with a caveat | The seed hashes with `bcryptjs` directly at cost 12 instead of importing `hashPassword`, because `src/features/auth/services/password.ts:2` imports `primaryDrizzleDb` and would construct the Neon pool as a seeding side effect (research R25). Recorded in Complexity Tracking. The produced hash is byte-compatible, so `compare` is unaffected.                                                                                                                                                                                                                                                      |

No gate fails. Three items pass with a recorded caveat and appear in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-e2e-in-continuous-integration/
├── spec.md                  # Clarified contract (input, not modified)
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── quickstart.md            # Phase 1 output
├── contracts/
│   ├── ci-job.md            # Workflow job contract
│   └── fixture-seed.md      # Seed invariants the blocking set may rely on
└── tasks.md                 # Phase 2 output (speckit.tasks, NOT created here)
```

No `data-model.md` is produced. The feature introduces no application entities; its only persisted data is the fixture seed, whose shape is fully specified by the existing `src/lib/schema.ts` tables and is contracted in `contracts/fixture-seed.md`.

### Source Code (repository root)

```text
.github/workflows/build.yml            # Add e2e-blocking, e2e-advisory, e2e, e2e-preview-smoke jobs; upload .next from build; capture the preview deployment URL
playwright.config.ts                   # Repair webServer probe, dead projects, ux-audit split; add trace/retries/workers/forbidOnly
package.json                           # Add test:e2e (and the CI-mode server script it invokes)
playwright-tests/
├── global-setup.ts                    # Signs in against the seeded CI account; gains an explicit no-auth mode for the smoke lane
├── mock-data.ts                       # Unchanged
├── latest-features.spec.ts            # Delete the Spanish-route case
├── public-pages.spec.ts               # Delete the two /es routes
├── ux-audit.spec.ts                   # Repoint ADMIN_PROJECTS onto the advisory projects
├── session-isolation.spec.ts          # Retained; guards the Cache Components invariant
└── (11 further spec files, retained)
scripts/
└── seed-e2e-fixtures.mjs              # New: deterministic fixture seed
src/
├── lib/db.ts                          # CI-only neonConfig branch gated on env.E2E_WS_PROXY
├── lib/validations/env.ts             # Declare E2E_WS_PROXY and E2E_ALLOW_INSECURE_HTTP as optional
└── proxy.ts                           # HTTPS redirect gated on env.E2E_ALLOW_INSECURE_HTTP
__tests__/lib/
├── db-ci-proxy.test.ts                # New: asserts neonConfig untouched when E2E_WS_PROXY is absent
└── proxy-https-redirect.test.ts       # New: asserts the 301 still fires when the gate is absent
docs/
├── development.md                     # Run/debug/extend the suite; blocking-advisory split; branch-protection enablement
└── features.md                        # Reconcile the localized-offline and responsive-layout coverage claims
drizzle/                               # Unchanged; the seed runs after drizzle-kit migrate
```

**Structure Decision**: The repository is a single Next.js application with a top-level `playwright-tests/` suite, a `scripts/` directory for operational tooling, and one workflow file. This feature adds no new directory. The seed goes to `scripts/` because that is where the two existing operational scripts live and because it must run between `drizzle-kit migrate` and server start, outside Playwright's lifecycle. The two unit tests go to `__tests__/lib/`, mirroring the source paths they guard, per the constitution's Testing Discipline layout rule.

## Phase 0 research summary

Full evidence in [research.md](./research.md). The decisions taken:

| #   | Decision                                                                                                                                                     | Load-bearing evidence                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Postgres + `ghcr.io/neondatabase/wsproxy` as `services:`; migrate with `drizzle-kit`; app reaches it through a CI-only `neonConfig` branch on `E2E_WS_PROXY` | R2 (bare container refused), R7 (exact `services:` topology proven), R9 (migrations need no proxy), R10 (full Drizzle path proven) |
| 2   | Serve the production build over plain HTTP and gate the `src/proxy.ts` 301 on `E2E_ALLOW_INSECURE_HTTP`                                                      | R13 (probe follows redirects), R14 (Next rewrites `nextUrl` to `https`), R15 (`__Secure-` cookies work on loopback)                |
| 3   | Four shards via `--shard=k/4` with `blob` reports merged by `merge-reports`                                                                                  | R19 (whole `(project, file)` groups; 25-case indivisible floor)                                                                    |
| 4   | Cache `~/.cache/ms-playwright` keyed on the installed Playwright version; Chromium only                                                                      | R21 (all projects are Chromium)                                                                                                    |
| 5   | Enable `trace: 'retain-on-failure'`; upload merged HTML report and `test-results` with 14-day retention                                                      | R20 (traces are currently off, so SC-007 is unmeetable as-is)                                                                      |
| 6   | Advisory lane as a `continue-on-error: true` job, excluded from the gate's `needs:`                                                                          | R23 (`orders-live` conditional assertions), R22 (`ux-audit` project gating)                                                        |
| 7   | `scripts/seed-e2e-fixtures.ts`, importing `src/lib/schema.ts`, hashing with `bcryptjs` directly, fixed 7-character Base62 ids                               | R25 (`password.ts` drags in the Neon pool), R24 (two option dimensions required)                                                   |
| 8   | `retries: 0` in the blocking lane; flakes are quarantined, not retried                                                                                       | SC-003 and the spec's User Story 3 quarantine rule                                                                                 |
| 9   | Reuse the `build` job's `.next` output rather than rebuilding per shard                                                                                      | FR-003 dependency edge; runtime env reads in `src/lib/env.ts`                                                                      |
| 10  | Repoint `ux-audit.spec.ts`'s `ADMIN_PROJECTS` onto the advisory projects instead of adding projects                                                          | R22; FR-018 forbids retiring the seven admin route audits                                                                          |

## Project classification

All 18 declared projects, matching the spec's Q4 table exactly. Auth requirement is read from each project's `storageState` in `playwright.config.ts`. Case counts are measured instances from `npx playwright test --list`; the post-repair column reflects the removals in the audit ledger below.

| Project                       | Spec file(s)                                                                 | Auth                                                        | Class    | Lane                     | Cases (now → after) |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | -------- | ------------------------ | ------------------- |
| `ai-stock-privacy`            | `ai-stock-privacy.spec.ts`                                                   | none                                                        | Blocking | `e2e-blocking` shard 1-4 | 2 → 2               |
| `orders-list`                 | `orders-list.spec.ts`                                                        | `.auth/admin.json`                                          | Blocking | `e2e-blocking` shard 1-4 | 3 → 3               |
| `latest-features`             | `latest-features.spec.ts`                                                    | none                                                        | Blocking | `e2e-blocking` shard 1-4 | 5 → 4               |
| `password-validation-desktop` | `password-validation.spec.ts`                                                | none                                                        | Blocking | `e2e-blocking` shard 1-4 | 6 → 6               |
| `account-password-validation` | `account-password-validation.spec.ts`                                        | `.auth/admin.json`                                          | Blocking | `e2e-blocking` shard 1-4 | 15 → 15             |
| `admin-desktop`               | `admin-views.spec.ts` (`ux-audit.spec.ts` removed)                           | `.auth/admin.json`                                          | Blocking | `e2e-blocking` shard 1-4 | 43 → 25             |
| `admin-mobile`                | `admin-views.spec.ts` (`ux-audit.spec.ts` removed)                           | `.auth/admin.json`                                          | Blocking | `e2e-blocking` shard 1-4 | 43 → 25             |
| `cart`                        | `cart.spec.ts`, `checkout-policy.spec.ts`, `checkout-error-recovery.spec.ts` | none                                                        | Blocking | `e2e-blocking` shard 1-4 | 18 → 18             |
| `accessibility-public`        | `accessibility.spec.ts`                                                      | none                                                        | Blocking | `e2e-blocking` shard 1-4 | 16 → 16             |
| `accessibility-authenticated` | `accessibility.spec.ts`                                                      | `.auth/admin.json`                                          | Blocking | `e2e-blocking` shard 1-4 | 6 → 6               |
| `product-navigation`          | `product-navigation.spec.ts`                                                 | none                                                        | Blocking | `e2e-blocking` shard 1-4 | 6 → 6               |
| `public-pages`                | `public-pages.spec.ts`                                                       | none                                                        | Blocking | `e2e-blocking` shard 1-4 | 19 → 17             |
| `session-isolation`           | `session-isolation.spec.ts`                                                  | builds its own contexts                                     | Blocking | `e2e-blocking` shard 1-4 | 2 → 2               |
| `variant-options`             | `variant-options.spec.ts`                                                    | `.auth/admin.json`                                          | Blocking | `e2e-blocking` shard 1-4 | 6 → 6               |
| `desktop-chrome`              | `ux-audit.spec.ts` (`ui-changes.spec.ts` pattern removed)                    | none for public; `describe`-scoped session for admin routes | Advisory | `e2e-advisory`           | 18 → 18             |
| `mobile-chrome`               | `ux-audit.spec.ts` (`ui-changes.spec.ts` pattern removed)                    | none for public; `describe`-scoped session for admin routes | Advisory | `e2e-advisory`           | 18 → 18             |
| `orders-live`                 | `orders-live.spec.ts`                                                        | `.auth/admin.json`                                          | Advisory | `e2e-advisory`           | 4 → 4               |
| `locale-links`                | none — `locale-links.spec.ts` does not exist                                 | n/a                                                         | Removed  | n/a                      | 0 → 0               |

Totals: **14 blocking projects / 151 cases**, **3 advisory projects / 40 cases**, **1 project removed**. Pre-repair 230 instances reconcile as 151 + 40 + 36 (the two `ux-audit` groups leaving the admin projects) + 2 (locale routes) + 1 (Spanish-route case) = 230.

Six of the blocking projects also run in the post-deployment smoke lane against the deployed preview: `public-pages`, `accessibility-public`, `product-navigation`, `ai-stock-privacy`, `session-isolation`, and `latest-features`, totalling 47 cases. Appearing in both lanes is not a mixed classification — a project's class describes the gate it feeds, and the smoke lane feeds none. The other eight blocking projects are excluded because they declare a `storageState` (`orders-list`, `account-password-validation`, `admin-desktop`, `admin-mobile`, `cart`, `accessibility-authenticated`, `variant-options`) or would write to the shared preview database (`variant-options`), and `password-validation-desktop` is excluded because it exercises a pure client-side form with nothing deployment-specific to observe.

Shard membership is assigned by Playwright's `--shard=k/4`, not pinned by hand, so it stays balanced as files grow (research Decision 3). The measured pre-repair assignment over the 14 blocking projects was 56 / 43 / 52 / 39 cases; removing the two 18-case `ux-audit` groups that currently sit in shards 2 and 3 brings the post-repair spread to roughly 25-40 per shard. The floor is set by `admin-views.spec.ts` at 25 cases, which research R19 proves is indivisible.

## Suite audit ledger

One row per spec file. Sixteen files exist; `locale-links.spec.ts` and `ui-changes.spec.ts` are referenced by `playwright.config.ts` and do not exist, so they are listed as configuration repairs rather than files.

| Spec file                               | Outcome            | Stale assertion / reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessibility.spec.ts`                 | Retained           | Rule-based audit over a fixed route list. Its "Product" route navigates from `/`, so it depends on the seed's catalog rows but on no specific identifier.                                                                                                                                                                                                                                                                                                                                                                                      |
| `account-password-validation.spec.ts`   | Retained           | Intercepts the account endpoint; needs only the seeded session.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `admin-views.spec.ts`                   | Retained           | Every admin endpoint is intercepted from `playwright-tests/mock-data.ts`. Reaching the admin shell still requires the seeded `ADMIN` account, because `src/proxy.ts:534-546` bounces non-staff roles.                                                                                                                                                                                                                                                                                                                                              |
| `ai-stock-privacy.spec.ts`              | Retained           | Intercepts the assistant and exchange-rate calls; asserts a privacy invariant independent of catalog contents.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `cart.spec.ts`                          | Retained           | Stateful cart, checkout, and rate interception make it self-contained.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `checkout-error-recovery.spec.ts`       | Retained           | Single case, fully intercepted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `checkout-policy.spec.ts`               | Retained           | Single case, fully intercepted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `latest-features.spec.ts`               | **Rewritten**      | Delete `latest-features.spec.ts:55-72`, `test('language preference switches to the equivalent Spanish route')` — line 63 opens a Language combobox, line 65 expects `['English','Español']`, line 68 expects `toHaveURL(/\/es\/about$/)`. All three describe removed behavior. Separately rename the case at `:37`, `'localized offline fallback offers recovery actions'`: its assertions are valid against the English-only `src/app/(public)/offline/page.tsx`, only the name is stale, so the name changes and the assertions do not (FR-009). |
| `orders-list.spec.ts`                   | Retained           | Every order and rate response is intercepted from the shared mock data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `orders-live.spec.ts`                   | Retained, advisory | `orders-live.spec.ts:107-108` hardcodes product id `tprod01`, which the seed deliberately does not provide (spec Q4). Lines `:118`, `:141`, `:150`, `:157`, `:218` gate assertions behind visibility checks that `console.log` instead of failing. Neither is repaired here — repairing them is the promotion condition.                                                                                                                                                                                                                           |
| `password-validation.spec.ts`           | Retained           | Public form validation, no data dependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `product-navigation.spec.ts`            | Retained           | Discovers product links at run time, so it survives catalog changes. Requires the seed to render at least one product card on the storefront root and one bestseller link; `src/lib/db-queries.ts:272+` uses a LEFT JOIN, so a product with no orders still appears.                                                                                                                                                                                                                                                                                           |
| `public-pages.spec.ts`                  | **Rewritten**      | Delete `'/es'` and `'/es/shop'` from `STATIC_PUBLIC_PAGES` at `public-pages.spec.ts:30-31`. Both routes were removed with localization; the remaining 17 entries are current.                                                                                                                                                                                                                                                                                                                                                                      |
| `session-isolation.spec.ts`             | Retained           | Guards the Cache Components isolation invariant that `012` introduced. Its optional second-account case skips when that credential is absent, which is what FR-010 requires.                                                                                                                                                                                                                                                                                                                                                                       |
| `ux-audit.spec.ts`                      | **Rewritten**      | `ux-audit.spec.ts:11` sets `ADMIN_PROJECTS = {admin-desktop, admin-mobile}` and each admin case `test.skip`s outside that set (`:172-180`). Because those projects lose the `ux-audit` pattern, the set is repointed onto `desktop-chrome` and `mobile-chrome` and the admin `describe` gains `test.use({ storageState: AUTH_STATE_PATH })`. No assertion changes; this preserves seven admin route audits that would otherwise be silently retired, against FR-018.                                                                               |
| `variant-options.spec.ts`               | Retained           | Depends on the seed guaranteeing a product with named options: `VariantSelector` renders `#variant-selector-label` with "Choose Your Options" only on the named-options branch, and `:88-92` requires at least two pressed option dimensions. It already throws at `:53-55` when no such product exists, which satisfies the spec's "fail loudly during setup" edge case.                                                                                                                                                                          |
| `playwright.config.ts:21` (config)      | **Repaired**       | `webServer.url` probes `${BASE_URL}/en/shop`; `/en` was removed and `/shop` was later folded into the storefront root. Becomes `${BASE_URL}/`, which exists at `src/app/(public)/page.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `playwright.config.ts:45,50` (config)   | **Repaired**       | `desktop-chrome` and `mobile-chrome` `testMatch` include `**/ui-changes.spec.ts`, which does not exist. Pattern removed; both projects keep `**/ux-audit.spec.ts`.                                                                                                                                                                                                                                                                                                                                                                                 |
| `playwright.config.ts:107,117` (config) | **Repaired**       | `admin-desktop` and `admin-mobile` `testMatch` include `**/ux-audit.spec.ts`, mixing an advisory file into blocking projects, which spec Q4 forbids. Pattern removed.                                                                                                                                                                                                                                                                                                                                                                              |
| `playwright.config.ts:173` (config)     | **Removed**        | `locale-links` matches only `**/locale-links.spec.ts`, which does not exist. The behavior it guarded was removed with localization, so the project is deleted rather than repointed (FR-016, SC-009).                                                                                                                                                                                                                                                                                                                                              |
| `docs/features.md:32` (docs)            | **Rewritten**      | Claims a "localized offline fallback"; `src/app/(public)/offline/page.tsx` is English-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/features.md:53` (docs)            | **Rewritten**      | Coverage claim includes "responsive layouts", which becomes advisory once `ux-audit.spec.ts` is confined to the advisory lane. FR-018 forbids counting an advisory suite as coverage, so the claim is reworded rather than deleted.                                                                                                                                                                                                                                                                                                                |

## CI job design

Three new jobs in `.github/workflows/build.yml`, plus one added step in the existing `build` job.

| Job id                | `name:` (check surface)                      | `needs:`         | Blocking | Notes                                                                                                                                    |
| --------------------- | -------------------------------------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `build`               | existing                                     | `test`           | yes      | Gains an `actions/upload-artifact@v7` step publishing `.next` minus `.next/cache`, retention 1 day                                       |
| `e2e-blocking`        | `E2E Blocking (shard ${{ matrix.shard }}/4)` | `build`          | yes      | `strategy.matrix.shard: [1,2,3,4]`, `fail-fast: false`, `timeout-minutes: 20`                                                            |
| `e2e-advisory`        | `E2E Advisory`                               | `build`          | no       | `continue-on-error: true`, `timeout-minutes: 20`                                                                                         |
| `e2e`                 | **`End-to-End Suite`**                       | `e2e-blocking`   | yes      | Merges the four blob reports, uploads the merged HTML report, fails if any shard failed. `timeout-minutes: 10`                           |
| `deploy-preview`      | existing                                     | existing         | n/a      | Gains a step output carrying the URL `vercel deploy` printed, exposed as a job `outputs:` value                                          |
| `e2e-preview-smoke`   | `E2E Preview Smoke`                          | `deploy-preview` | no       | `continue-on-error: true`, `timeout-minutes: 15`, guarded on a non-empty deployment URL. Outside the gate's `needs:` and off the PR path |

**The required status check is the job named `End-to-End Suite`.** It is a non-matrix job, so GitHub publishes exactly one check with that literal string, which satisfies FR-013's "stable, unique name". The matrix job names carry a shard suffix and are deliberately not the required check; `e2e-advisory` is excluded from `needs:` so an advisory failure cannot gate merge. `e2e-preview-smoke` is likewise excluded, and additionally cannot appear on a pull request at all because `deploy-preview` only runs on a `develop` push.

### Triggers

`.github/workflows/build.yml` already fires on pull requests and on pushes to the default branch, so FR-001 needs no trigger change. `pull_request` (not `pull_request_target`) means fork pull requests run with a read-only token and no secrets, which is exactly the condition SC-008 asks the blocking set to survive — and it does, because nothing in the end-to-end path reads a secret.

### Short-circuit on build failure

`needs: [build]` makes GitHub skip both end-to-end jobs when `build` fails. A skipped `e2e-blocking` leaves `e2e` skipped too, and a skipped required check does not report success, so the pull request stays blocked. This satisfies FR-003 with one edge and no conditional expressions.

### Services and environment (both end-to-end jobs)

| Service    | Image                                 | Ports       | Configuration                                                                              |
| ---------- | ------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `postgres` | `postgres:16-alpine`                  | `5432:5432` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` as literals; `--health-cmd pg_isready` |
| `wsproxy`  | `ghcr.io/neondatabase/wsproxy:latest` | `5433:80`   | `APPEND_PORT=postgres:5432`, `ALLOW_ADDR_REGEX=.*`                                         |

`APPEND_PORT` pins the proxy target to the service alias, so the driver sends no `?address=` parameter and `DATABASE_URL` may point at `localhost:5432` for both the application and host-side tooling (research R7, R8). Setting `APPEND_PORT` and sending an address simultaneously is a verified failure mode (research R6). Readiness for the proxy is a `bash` `/dev/tcp` wait on `5433`, since the image ships no health command.

Environment, all literal and non-secret:

```text
DATABASE_URL=postgresql://<literal user>:<literal password>@localhost:5432/<literal db>
E2E_WS_PROXY=localhost:5433/v1
E2E_ALLOW_INSECURE_HTTP=true
NEXTAUTH_SECRET=<literal placeholder, same pattern as the existing build job>
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_TRUST_HOST=true
PLAYWRIGHT_BASE_URL=http://localhost:3000
COPILOT_DEV_EMAIL=<literal fixture address>
COPILOT_DEV_PASS=<literal fixture password>
```

`AUTH_TRUST_HOST=true` is declared at `src/lib/validations/env.ts:132` and read directly by NextAuth v5; it makes the library trust the loopback `Host` header instead of demanding an `AUTH_URL`.

### Step sequence (blocking shard)

1. `actions/checkout@v7`
2. `actions/setup-node@v7` with `node-version: 24`, `cache: npm`
3. `npm ci`
4. `actions/download-artifact@v8.0.1` for `.next`
5. Resolve the Playwright version from `node_modules/@playwright/test/package.json` into a step output
6. `actions/cache@v6` on `~/.cache/ms-playwright`, key `${{ runner.os }}-playwright-<version>`
7. `npx playwright install --with-deps chromium` on a miss, `npx playwright install-deps chromium` on a hit
8. Wait for TCP `5433`
9. `npx drizzle-kit migrate`
10. `npx tsx scripts/seed-e2e-fixtures.ts`
11. `npm run test:e2e -- --shard=${{ matrix.shard }}/4 --reporter=blob`
12. `actions/upload-artifact@v7` for `blob-report/` and `test-results/`, `if: always()`, retention 14 days

The advisory job is identical except that step 11 selects the three advisory projects and the job carries `continue-on-error: true`.

Playwright's own `webServer` starts the application, so no separate server step is needed and the readiness probe on `${BASE_URL}/` doubles as a check that migrations and the seed actually took: if the seed failed, `/` cannot render and the probe times out, failing the job during setup rather than producing vacuous passes.

### Post-deployment smoke lane

`e2e-preview-smoke` exists to observe the one class of fault the local lane structurally cannot: Vercel edge behavior, the genuine `src/proxy.ts` HTTPS path that `E2E_ALLOW_INSECURE_HTTP` suppresses locally, Cache Components prerendering on the real runtime, and environment misconfiguration. It gates nothing (FR-019) and does not count as coverage for any journey the blocking lane owns (FR-022).

**Target resolution.** `deploy-preview` currently discards the URL `vercel deploy` prints. It gains a step that captures stdout into a step output, and the job gains an `outputs:` mapping so `e2e-preview-smoke` can read it as `PLAYWRIGHT_BASE_URL`. FR-020 forbids substituting a hardcoded alias: `vercel deploy` without `--prod` mints a per-deployment host and moves no alias, so an alias names a host rather than the revision under test, and the workflow's `cancel-in-progress: true` concurrency makes that a race.

**Skip rather than fail.** The job carries an `if:` guard on the captured URL being non-empty, so an unavailable `VERCEL_TOKEN` — the permanent condition on fork pull requests — leaves the lane skipped. Combined with `continue-on-error: true`, no failure mode of this lane can turn a contributor's pull request red (FR-023, and the spec's fork edge case).

**Readiness gate.** Before the suite runs, a bounded poll requests `${PLAYWRIGHT_BASE_URL}/` until it answers 200, with a cap well inside `timeout-minutes: 15`. A cold deployment is therefore a wait, not a reported breakage.

**Project subset.** Exactly the six read-only projects named in spec Q6: `public-pages`, `accessibility-public`, `product-navigation`, `ai-stock-privacy`, `session-isolation`, `latest-features`. Selected with repeated `--project=` flags on the same `npm run test:e2e` entry point FR-017 mandates. Everything holding a `storageState` is excluded because it would need a real credential; `variant-options` and `orders-live` are excluded because they write; `cart` and the two checkout files are excluded because they are meaningful only under interception; `ux-audit` is excluded because it has no pass-or-fail contract.

**No-authentication mode.** `playwright-tests/global-setup.ts` throws today when `COPILOT_DEV_EMAIL` and `COPILOT_DEV_PASS` are both absent and no cached state file exists. The smoke lane must not be handed placeholder credentials, so setup gains an explicit `PLAYWRIGHT_SKIP_AUTH` path that returns without signing in. The existing throw is untouched for every other invocation, so this widens no assertion and weakens no lane (FR-009, FR-021). `session-isolation.spec.ts` builds its own contexts and its optional second-account case already skips when that credential is absent, so it is safe in a lane with no stored state; the other five projects declare no `storageState` in `playwright.config.ts`.

**Environment.** Only `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_SKIP_AUTH` are set. No database, no proxy sidecar, no `E2E_WS_PROXY`, no `E2E_ALLOW_INSECURE_HTTP` — the point of this lane is the deployed configuration, so injecting the CI gates would defeat it.

### Caching strategy

| Cache               | Key                                               | Restore behavior on miss                      |
| ------------------- | ------------------------------------------------- | --------------------------------------------- |
| npm                 | `actions/setup-node@v7` `cache: npm` (existing)   | Full `npm ci` download                        |
| Playwright browsers | `${{ runner.os }}-playwright-<installed version>` | `npx playwright install --with-deps chromium` |

The version comes from the installed package rather than from `package.json`'s `^1.62.0` range, so the key tracks what is actually on disk. Only Chromium is installed. A miss costs a download, not a failure, which is what the spec's edge case requires.

### Artifacts

| Artifact              | Producer       | Contents                                         | Retention |
| --------------------- | -------------- | ------------------------------------------------ | --------- |
| `next-build`          | `build`        | `.next` excluding `.next/cache`                  | 1 day     |
| `blob-report-<shard>` | `e2e-blocking` | Playwright blob report for that shard            | 14 days   |
| `e2e-traces-<shard>`  | `e2e-blocking` | `test-results/` — traces and failure screenshots | 14 days   |
| `e2e-report`          | `e2e`          | Merged HTML report across all four shards        | 14 days   |
| `e2e-advisory-report` | `e2e-advisory` | HTML report, traces, and `ux-audit` screenshots  | 14 days   |
| `e2e-preview-smoke-report` | `e2e-preview-smoke` | HTML report and traces from the deployed run | 14 days   |

`trace: 'retain-on-failure'` must be added to `playwright.config.ts` for these to contain anything — traces are currently off (research R20). `screenshot: 'only-on-failure'` is already set at `playwright.config.ts:35`.

### Configuration changes to `playwright.config.ts`

| Setting                         | Now                   | After                                              | Why                                                                        |
| ------------------------------- | --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `webServer.url`                 | `${BASE_URL}/en/shop` | `${BASE_URL}/`                                     | The probed route was removed (FR-002)                                      || `webServer.command`             | `npm run dev`         | CI-mode branch selects the production-build server | FR-002 requires both modes, selected by environment                        |
| `webServer.reuseExistingServer` | `true`                | `!process.env.CI`                                  | Prevents a stale server being reused in a job                              |
| `trace`                         | unset (off)           | `'retain-on-failure'`                              | SC-007 requires a trace per failed test                                    |
| `retries`                       | unset (0)             | `0`, explicitly                                    | Decision 8; makes the intent legible rather than incidental                |
| `workers`                       | unset                 | `2` under CI                                       | 4-vCPU runners; the library default is half the CPU count                  |
| `forbidOnly`                    | unset                 | `!!process.env.CI`                                 | A stray `test.only` would silently shrink the blocking set, against FR-009 |

## Fixture seed contract

Full invariants in [contracts/fixture-seed.md](./contracts/fixture-seed.md). Location: `scripts/seed-e2e-fixtures.ts`, run by `node` immediately after `npx drizzle-kit migrate` and before the server starts.

What the seed must guarantee for the blocking set to pass deterministically:

| Guarantee                                                                                                                                                                                                     | Consumer                                                                        | Source of the requirement                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| One `User` whose `email` equals `COPILOT_DEV_EMAIL`, whose `passwordHash` verifies `COPILOT_DEV_PASS`, with `role = 'ADMIN'`, `emailVerified` set, `lockedUntil` null, and `sessionVersion` present           | `playwright-tests/global-setup.ts:29-41`, and the eight `storageState` projects | `src/lib/auth.ts:81-180` — credentials sign-in rejects an unverified email at `:156-157` and a locked account at `:113`                              |
| At least one active `Product` with a `Category`, an image, and stock, visible on the storefront root `/`                                                                                                                      | `public-pages`, `product-navigation`, `accessibility-public`                    | `product-navigation.spec.ts` discovers links at run time; `accessibility.spec.ts` reaches its "Product" route by navigating from `/`             |
| At least one `Product` carrying **two** `ProductOption` rows, each with at least two `ProductOptionValue` rows, wired to `ProductVariant` rows through `ProductVariantOptionValue`, all with stock above zero | `variant-options`                                                               | `VariantSelector` renders the named-options branch only when options exist; `variant-options.spec.ts:88-92` requires at least two pressed dimensions |
| Variant SKUs are dash-delimited so the admin "generate from SKUs" path has valid input                                                                                                                        | `variant-options` admin cases at `:176-193`                                     | `deriveOptionsFromSkus` in `src/app/(public)/products/[id]/lib/variant-utils.ts:124-144` requires equal-arity dash-delimited SKUs                    |
| No product carries the identifier `tprod01`                                                                                                                                                                   | `orders-live` stays advisory                                                    | Spec Q4 basis; adding it would silently promote a suite that still asserts conditionally                                                             |

Determinism and drift control:

- All catalog identifiers are fixed 7-character Base62 literals matching the `varchar(7)` shape that `generateShortId()` produces. The helper itself is random (`src/lib/short-id.ts`), so it cannot be used where the suite must address a row by id. `User.id` and `Account.id` remain `text` with the schema's `crypto.randomUUID()` default, which the coding standard already exempts for auth tables.
- The seed imports table definitions from `src/lib/schema.ts`, which imports no env and no database (research R25), so it stays in lockstep with `drizzle/`: a migration that adds a non-nullable column without a default breaks the seed at type-check, not at run time. The seed never issues DDL — schema changes remain Drizzle-migration-only.
- The seed is idempotent, deleting its own rows by known id before inserting, so a re-run inside the same job is safe. The database is destroyed with the job regardless, satisfying the spec's "no run may depend on data left behind" edge case.
- Password hashing calls `bcryptjs` directly at cost 12 rather than importing `hashPassword`, because `src/features/auth/services/password.ts:2` imports `primaryDrizzleDb` and would construct the Neon pool as a side effect. The hash is byte-compatible.

## Time budget accounting

Budget: 15 minutes for the end-to-end job, 30 minutes for total pull-request CI (spec Q3, FR-011, SC-006).

**Per-shard fixed overhead**, from the step sequence above:

| Step                                                  | Warm cache | Cold cache |
| ----------------------------------------------------- | ---------- | ---------- |
| Checkout + setup-node                                 | 0:20       | 0:20       |
| `npm ci`                                              | 1:00       | 2:00       |
| Download `.next`                                      | 0:30       | 0:30       |
| Playwright browser restore or install (Chromium only) | 0:15       | 1:30       |
| Services ready + `drizzle-kit migrate` + seed         | 0:30       | 0:30       |
| `webServer` boot and readiness probe on `/`       | 0:20       | 0:20       |
| **Total overhead**                                    | **2:55**   | **5:10**   |

**Per-shard test time.** The blocking set is 151 cases over four shards, so the mean shard carries 38 and the busiest carries about 40, bounded below by the indivisible 25-case `admin-views.spec.ts` group (research R19). With `workers: 2`:

| Scenario                                                     | Arithmetic                                               | Shard test time |
| ------------------------------------------------------------ | -------------------------------------------------------- | --------------- |
| Realistic — 4 s median per case on a local production server | 40 × 4 s ÷ 2 workers                                     | 1:20            |
| Pessimistic — 8 s median                                     | 40 × 8 s ÷ 2 workers                                     | 2:40            |
| Ceiling — every case consumes its full timeout               | busiest shard, 34 × 30 s + 6 × 60 s = 1380 s ÷ 2 workers | 11:30           |

Worst realistic case is 5:10 cold overhead plus 2:40 pessimistic tests, or 7:50, comfortably inside 15 minutes. The absolute ceiling of 11:30 plus 5:10 exceeds the budget, which is precisely why `timeout-minutes: 20` sits above it: a run pathological enough to hit the ceiling is a hung run and must fail rather than idle, as FR-011 requires. The `e2e` merge job adds about one minute.

**Total pull-request CI.** The critical path is `test` → `build` → `e2e-blocking` → `e2e`. Against the current workflow's observed shape that is roughly 4 + 5 + 8 + 1 = 18 minutes, inside the 30-minute budget with headroom. `e2e-advisory` runs in parallel with `e2e-blocking` and carries the same 20-minute cap, so it cannot extend the critical path — it is not in the gate's `needs:`.

**Smoke lane.** It is off the pull-request critical path entirely, because `deploy-preview` runs only on a `develop` push, so SC-006's 30-minute budget is untouched no matter what the lane costs. Budgeted at roughly 6 minutes: about 1:30 checkout, `npm ci`, and browser restore; up to 2:00 in the readiness poll for a cold deployment; and 47 cases over two workers at an 8-second pessimistic median, or 3:10. `timeout-minutes: 15` sits above that with room for a slow deployment, and `continue-on-error: true` means even a timeout is inert.

## Rollback

The change set is designed to be revertible as a unit and to degrade safely at each stage.

| Stage                                 | Action                                                                                                                                                       | Effect                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The required check proves unstable | Remove `End-to-End Suite` from the branch-protection required list. No commit needed.                                                                        | Merges unblock within seconds. The job still runs and still publishes artifacts.                                                                                    |
| 0. The smoke lane is noisy or unwanted | Delete the `e2e-preview-smoke` job. Optionally also revert the `deploy-preview` URL-capture step and the `PLAYWRIGHT_SKIP_AUTH` branch.                     | Nothing depends on it: it is not in any `needs:`, it is already `continue-on-error: true`, and it never runs on a pull request. Removing it changes no gate.        |
| 2. The instability is in one project  | Move that project from the blocking lane to the advisory lane and record the tracked reason and promotion condition, per FR-018 and the spec's User Story 3. | Coverage is retained; the gate stops flapping. One workflow line and one docs row.                                                                                  |
| 3. The whole feature must go          | Revert the single squashed commit.                                                                                                                           | `.github/workflows/build.yml` returns to nine jobs, `playwright.config.ts` to its current 18 projects, and the two environment gates disappear from the Zod schema. |

Nothing outside the revert needs undoing: the database and both service containers are destroyed with the job, no migration is added, no session state is committed, and the two CI-only gates are inert when their variables are absent — which is the state the revert restores.

## Complexity Tracking

| Violation                                                                            | Why Needed                                                                                                                                                                                                                                  | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Second service container (`ghcr.io/neondatabase/wsproxy`) — Principle VII            | `src/lib/db.ts` reaches Postgres over WebSocket and `src/lib/env.ts` throws at import, so a bare `postgres:16` service cannot boot the application at all (research R2).                                                                    | A bare Postgres service was tried and refused the connection. Swapping the driver in CI changes production behavior, against FR-014. A hosted Neon branch needs a secret, which breaks fork pull requests, against FR-010 and SC-008.                                                            |
| `E2E_ALLOW_INSECURE_HTTP` suppresses the `src/proxy.ts` HTTPS redirect — Principle V | `next start` cannot serve TLS, Playwright's readiness probe follows the resulting 301 into a dead port, and Next.js rewrites the three `src/proxy.ts` auth redirects to unreachable absolute `https://` locations (research R12, R13, R14). | Header injection was tried on paper and fails on both counts. A TLS terminator sidecar would be roughly 60 lines of transport code plus a per-job certificate to obtain TLS on loopback, which carries no security value; research R15 removed the cookie argument that would have justified it. |
| Seed hashes with `bcryptjs` directly instead of `hashPassword` — Principle VIII      | `src/features/auth/services/password.ts:2` imports `primaryDrizzleDb`, so importing the helper would construct the Neon pool as a side effect of seeding (research R25).                                                                    | Extracting a pure hashing module would change production source for a CI-only convenience. The produced hash is byte-compatible with the helper's output, so `compare` is unaffected and the duplication is a single call with a shared constant cost.                                           |
| Fixed literal ids instead of `generateShortId()` — coding standard                   | `generateShortId()` is random by design (`src/lib/short-id.ts`). A seed whose identifiers change per run cannot back a deterministic suite, and SC-003 requires ten runs to produce identical results.                                      | Deriving ids from a seeded pseudo-random generator would be indirection with the same outcome. The literals conform to the same `varchar(7)` Base62 shape the column enforces.                                                                                                                   |
