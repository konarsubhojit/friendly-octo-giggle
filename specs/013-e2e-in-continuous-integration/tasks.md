# Tasks: End-to-End Suite in Continuous Integration

**Input**: Design documents in `/specs/013-e2e-in-continuous-integration/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `contracts/ci-job.md`, `contracts/fixture-seed.md`

**Tests**: Two unit tests are mandatory, not optional. They guard the inertness of the two CI-only environment gates, which is the only thing standing between this feature and a production behavior change (FR-014, plan Constitution Check II and V).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no ordering dependency
- **[Story]**: US1 (blocking gate), US2 (suite asserts today's product), US3 (determinism), or `INFRA` for shared prerequisites

## Path conventions

Single Next.js application. Application source under `src/`, browser suite under `playwright-tests/`, operational scripts under `scripts/`, unit tests under `__tests__/`, one workflow at `.github/workflows/build.yml`.

---

## Phase 1: Harness repair (INFRA)

**Purpose**: The suite cannot start today. `playwright.config.ts:21` probes `/en/shop`, a route deleted with localization, and three project definitions match no file. Nothing downstream can be validated until this phase lands. Satisfies FR-002, FR-016, FR-017, SC-009.

- [x] **T001** [INFRA] In `playwright.config.ts`, change `webServer.url` from `${BASE_URL}/en/shop` to `${BASE_URL}/`. The storefront root renders the catalog, so a failed migration or seed times out here rather than passing vacuously. (FR-002)
- [x] **T002** [INFRA] In `playwright.config.ts`, make `webServer.command` select by environment: `npm run start:e2e` when `process.env.CI` is set, `npm run dev` otherwise. FR-002 requires both modes selected by environment rather than by editing the file.
- [x] **T003** [INFRA] In `playwright.config.ts`, change `webServer.reuseExistingServer` from the literal `true` to `!process.env.CI`, so a job cannot silently reuse a stale server.
- [x] **T004** [INFRA] In `playwright.config.ts`, add to `use`: `trace: 'retain-on-failure'`. Traces are off today, so SC-007 is unmeetable without this. `screenshot: 'only-on-failure'` is already present and stays. (SC-007, contracts/ci-job.md "Artifacts")
- [x] **T005** [INFRA] In `playwright.config.ts`, add top level `retries: 0`, `workers: process.env.CI ? 2 : undefined`, and `forbidOnly: !!process.env.CI`. `retries: 0` is explicit so the determinism intent is legible (plan Decision 8); `forbidOnly` stops a stray `test.only` silently shrinking the blocking set, against FR-009.
- [x] **T006** [INFRA] In `playwright.config.ts`, remove `'**/ui-changes.spec.ts'` from the `testMatch` of `desktop-chrome` (line 45) and `mobile-chrome` (line 50). That file does not exist. Both projects keep `'**/ux-audit.spec.ts'`. (FR-016)
- [x] **T007** [INFRA] In `playwright.config.ts`, remove `'**/ux-audit.spec.ts'` from the `testMatch` of `admin-desktop` (line 107) and `admin-mobile` (line 117), leaving `'**/admin-views.spec.ts'`. Spec Q4 forbids a project mixing blocking and advisory spec files.
- [x] **T008** [INFRA] In `playwright.config.ts`, delete the entire `locale-links` project definition. Its only pattern matches a file that does not exist and the behavior it guarded was removed with localization. (FR-016, SC-009)
- [x] **T009** [INFRA] In `package.json`, add `"test:e2e": "playwright test"` and `"start:e2e": "next start -p 3000"`. FR-017 requires one documented command that CI invokes; only flags may differ between lanes.
- [x] **T010** [INFRA] Verify every remaining project resolves to at least one existing spec file by running `npx playwright test --list` and confirming no project reports zero tests. (SC-009)

**Checkpoint**: `npx playwright test --list` enumerates 17 projects with no empty project and no reference to a missing file.

---

## Phase 2: CI-only environment gates (INFRA)

**Purpose**: `src/lib/env.ts` throws at import when `DATABASE_URL` is absent and `src/lib/db.ts` builds a Neon WebSocket pool at module load, so no server-rendered route can render in CI without both a database and a way to reach it. `src/proxy.ts` additionally 301s every plain-HTTP request outside development, which `next start` cannot satisfy. Both gates must be inert when their variables are absent. Satisfies FR-014, plan research R1-R16.

- [x] **T011** [INFRA] In `src/lib/validations/env.ts`, add `E2E_WS_PROXY: z.string().optional()` and `E2E_ALLOW_INSECURE_HTTP: z.enum(['true', 'false']).optional()` to `BaseEnvSchema`. Both optional, both read through the validated `env` object rather than raw `process.env`, per Constitution Principle II.
- [x] **T012** [INFRA] In `src/lib/db.ts`, before the pool is constructed, add a branch that runs only when `env.E2E_WS_PROXY` is set: assign `neonConfig.wsProxy`, `neonConfig.useSecureWebSocket = false`, and `neonConfig.pipelineConnect = false`. When the variable is absent, `neonConfig` must not be touched at all. (research R7, R10)
- [x] **T013** [INFRA] In `src/proxy.ts`, extend the HTTPS-redirect condition so the 301 is suppressed when `env.E2E_ALLOW_INSECURE_HTTP === 'true'`. The existing `process.env.NODE_ENV !== 'development' && proto === 'http'` condition is otherwise unchanged, so deployed behavior is identical. (research R11-R16)
- [x] **T014** [P] [INFRA] Create `__tests__/lib/db-ws-proxy.test.ts` asserting that importing `src/lib/db.ts` with `E2E_WS_PROXY` absent leaves `neonConfig.wsProxy` undefined and `useSecureWebSocket` at its default, and that setting the variable applies all three settings. This is the inertness proof for T012.
- [x] **T015** [P] [INFRA] Add an `E2E_ALLOW_INSECURE_HTTP` describe block to `__tests__/proxy.test.ts` asserting the 301 still fires for a plain-HTTP request when `E2E_ALLOW_INSECURE_HTTP` is absent, and is suppressed when it is `'true'`. This is the inertness proof for T013 and the mitigation recorded against Constitution Principle V.

**Checkpoint**: `npm test` passes. Both new tests fail if either gate is made unconditional.

---

## Phase 3: Fixture seed (INFRA)

**Purpose**: Deliver the only data a blocking project may assume. Full invariants in `contracts/fixture-seed.md`. Satisfies FR-014, FR-015, SC-010.

- [x] **T016** [INFRA] Create `scripts/seed-e2e-fixtures.ts`. It must import table objects from `src/lib/schema.ts` (which imports no env and no database), connect over direct `pg` TCP rather than the Neon driver, issue no DDL, delete its own rows by known identifier before inserting so it is idempotent, and exit non-zero on any failure so a partial seed is never reported as success. Carry the `/* eslint-disable no-console */` header both committed scripts already use, since `eslint.config.js` does not disable `no-console` for `scripts/**`. `const` arrow functions only; no comments beyond the lint suppression.
- [x] **T017** [INFRA] Implement seed invariant **G1** — the admin account: `email` equal to the job's `COPILOT_DEV_EMAIL`, `passwordHash` a `bcryptjs` hash of `COPILOT_DEV_PASS` at cost 12, `role = 'ADMIN'`, `emailVerified` non-null, `lockedUntil` null, `sessionVersion` present. Hash with `bcryptjs` directly rather than importing `hashPassword`, because `src/features/auth/services/password.ts:2` imports `primaryDrizzleDb` and would construct the Neon pool as a seeding side effect (research R25).
- [x] **T018** [INFRA] Implement seed invariant **G2** — at least one active `Product` with a `Category`, an image, stock above zero, rendering as a card on the storefront root `/` with a reachable detail page. Consumed by `public-pages`, `product-navigation`, `accessibility-public`, and the `webServer` readiness probe.
- [x] **T019** [INFRA] Implement seed invariant **G3** — a `Product` carrying two `ProductOption` rows with at least two `ProductOptionValue` rows each, wired to `ProductVariant` rows through `ProductVariantOptionValue`, all with stock above zero, and dash-delimited SKUs of equal arity. Required because `VariantSelector` renders the named-options branch only when options exist, `variant-options.spec.ts:88-92` needs two pressed dimensions, and `deriveOptionsFromSkus` needs equal-arity dash-delimited SKUs.
- [x] **T020** [INFRA] Implement seed invariant **G4** — fixed 7-character Base62 literal identifiers for `Category`, `Product`, `ProductOption`, `ProductOptionValue`, and `ProductVariant`. `generateShortId()` is random by design and cannot back a suite that addresses rows across runs (SC-003). `User` and `Account` keep the schema's `crypto.randomUUID()` default and are addressed by email.
- [x] **T021** [INFRA] Enforce seed invariant **G5** — assert no product carries the identifier `tprod01`. Seeding it would silently promote `orders-live`, which still asserts conditionally. Seed no order history, no second user account, and no reviews, coupons, or shipping zones.

**Checkpoint**: `npx drizzle-kit migrate && npx tsx scripts/seed-e2e-fixtures.ts` against a local Postgres exits zero and re-running exits zero again.

---

## Phase 4: Suite audit — the suite asserts today's product (US2)

**Purpose**: Story 2. A suite that fails for historical reasons produces noise, and noisy required checks get bypassed. Every edit here either rewrites an assertion against current behavior or deletes it with a recorded reason; none is weakened. Satisfies FR-007, FR-008, FR-009, SC-005.

- [x] **T022** [P] [US2] In `playwright-tests/latest-features.spec.ts`, delete the whole `test('language preference switches to the equivalent Spanish route')` case at lines 55-72. Line 63 opens a Language combobox, line 65 expects `['English', 'Español']`, line 68 expects `toHaveURL(/\/es\/about$/)` — all three describe behavior removed by the localization removal.
- [x] **T023** [P] [US2] In the same file, rename the case at line 37 from `'localized offline fallback offers recovery actions'` to drop the word "localized". Its assertions are valid against the English-only `src/app/(public)/offline/page.tsx`, so only the name is stale. Change the name, change no assertion (FR-009).
- [x] **T024** [P] [US2] In `playwright-tests/public-pages.spec.ts`, delete `'/es'` and `'/es/shop'` from `STATIC_PUBLIC_PAGES` at lines 30-31. Both routes were removed with localization; the remaining 17 entries are current.
- [x] **T025** [US2] In `playwright-tests/ux-audit.spec.ts`, repoint `ADMIN_PROJECTS` at line 11 from `{'admin-desktop', 'admin-mobile'}` to `{'desktop-chrome', 'mobile-chrome'}`, and add `test.use({ storageState: AUTH_STATE_PATH })` to the `admin route UX audit` describe block so those cases still reach the admin shell. Depends on T007. Without this, the seven admin route audits are silently retired when the admin projects lose the `ux-audit` pattern, against FR-018. No assertion changes.
- [x] **T026** [US2] Confirm no test in the repository asserts a locale-prefixed route, a language switcher, or Spanish content by grepping `playwright-tests/` for `/es`, `Español`, and `Idioma`. (SC-005)
- [x] **T027** [US2] Record the per-file audit outcome — retained, rewritten, or removed, with justification — for all sixteen spec files. The ledger already exists in `plan.md`; verify each row still matches the file after T022-T025 and correct any drift. (FR-008, spec Key Entity "Suite Audit Record")

**Checkpoint**: No `/es`, `Español`, or language-switcher assertion remains. `npx playwright test --list` reports 191 instances.

---

## Phase 5: Blocking and advisory CI lanes (US1, US3)

**Purpose**: Story 1 — a browser regression blocks merge. Satisfies FR-001, FR-003, FR-004, FR-005, FR-006, FR-010, FR-011, FR-013, SC-001, SC-006, SC-007, SC-008.

- [x] **T028** [US1] In `.github/workflows/build.yml`, add an `actions/upload-artifact@v7` step to the existing `build` job publishing `.next` excluding `.next/cache` as artifact `next-build`, retention 1 day. Reusing this output is what makes FR-003's dependency edge cheap (plan Decision 9).
- [x] **T029** [US1] Add the `e2e-blocking` job: `name: E2E Blocking (shard ${{ matrix.shard }}/4)`, `needs: [build]`, `strategy.matrix.shard: [1, 2, 3, 4]`, `strategy.fail-fast: false`, `timeout-minutes: 20`. The `needs:` edge satisfies FR-003 — a failed build skips the job, and a skipped required check does not report success. The 20-minute cap sits above the 15-minute budget so a hung run fails rather than idles (FR-011).
- [x] **T030** [US1] Give `e2e-blocking` the two service containers from `contracts/ci-job.md`: `postgres:16-alpine` on host port 5432 with literal non-secret `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` and `--health-cmd pg_isready`, and `ghcr.io/neondatabase/wsproxy:latest` on host port 5433 with `APPEND_PORT=postgres:5432` and `ALLOW_ADDR_REGEX=.*`. `APPEND_PORT` and a driver-supplied `?address=` are mutually exclusive (research R6), so only `APPEND_PORT` is set.
- [x] **T031** [US1] Give `e2e-blocking` the literal, non-secret environment block from `contracts/ci-job.md`: `DATABASE_URL`, `E2E_WS_PROXY=localhost:5433/v1`, `E2E_ALLOW_INSECURE_HTTP=true`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `AUTH_TRUST_HOST=true`, `PLAYWRIGHT_BASE_URL=http://localhost:3000`, `COPILOT_DEV_EMAIL`, `COPILOT_DEV_PASS`. **No repository secret may be referenced by this job** — that is what makes SC-008 hold for fork pull requests (FR-010).
- [x] **T032** [US1] Add the `e2e-blocking` step sequence: checkout, `actions/setup-node@v7` at Node 24 with `cache: npm`, `npm ci`, download the `next-build` artifact, resolve the installed Playwright version from `node_modules/@playwright/test/package.json` into a step output, `actions/cache@v6` on `~/.cache/ms-playwright` keyed `${{ runner.os }}-playwright-<version>`, install Chromium (full install on a miss, `install-deps` only on a hit), wait for TCP 5433 with a `bash` `/dev/tcp` loop since the proxy image ships no health command, `npx drizzle-kit migrate`, `npx tsx scripts/seed-e2e-fixtures.ts`, then the test command. Keying on the installed version rather than the `^1.62.0` range makes the key track what is on disk (FR-004).
- [x] **T033** [US1] Set the `e2e-blocking` test command to `npm run test:e2e -- --shard=${{ matrix.shard }}/4 --reporter=blob`. Same entry point as the documented local command, per FR-017.
- [x] **T034** [US1] Add `if: always()` upload steps to `e2e-blocking` for `blob-report-<shard>` and `e2e-traces-<shard>` (`test-results/`), both with 14-day retention. (FR-005, SC-007)
- [x] **T035** [P] [US3] Add the `e2e-advisory` job: `name: E2E Advisory`, `needs: [build]`, `continue-on-error: true`, `timeout-minutes: 20`, identical services, environment, and setup steps to `e2e-blocking`, running `npm run test:e2e -- --project=desktop-chrome --project=mobile-chrome --project=orders-live` and uploading `e2e-advisory-report` with `if: always()`. It is deliberately absent from every `needs:` list so an advisory failure cannot gate merge (FR-018, Story 3 acceptance 2).
- [x] **T036** [US1] Add the `e2e` gate job: `name: End-to-End Suite`, `needs: [e2e-blocking]`, `timeout-minutes: 10`. It downloads all four blob reports, runs `npx playwright merge-reports --reporter html ./all-blob-reports`, uploads `e2e-report` with 14-day retention, and fails if any shard failed. **This literal name is the required status check** and renaming it invalidates branch protection (FR-013, contracts/ci-job.md "Change control").

**Checkpoint**: On a pull request, `End-to-End Suite` appears exactly once, `E2E Blocking (shard N/4)` appears four times, and `E2E Advisory` is present but ungating.

---

## Phase 6: Post-deployment smoke lane (US1 support)

**Purpose**: Observe the fault class the local lane structurally cannot — Vercel edge behavior, the genuine `src/proxy.ts` HTTPS path that `E2E_ALLOW_INSECURE_HTTP` suppresses locally, Cache Components prerendering on the real runtime, and environment misconfiguration. Satisfies FR-019 through FR-023 and SC-011. Gates nothing.

- [x] **T037** In `playwright-tests/global-setup.ts`, add an early return when `PLAYWRIGHT_SKIP_AUTH` is set, before the `COPILOT_DEV_EMAIL`/`COPILOT_DEV_PASS` check. The existing throw is untouched for every other invocation, so no lane is weakened (FR-009, FR-021). The smoke lane must never be fed placeholder credentials.
- [x] **T038** In `.github/workflows/build.yml`, change the existing `deploy-preview` job to capture the URL `vercel deploy` prints into a step output and expose it through a job-level `outputs:` mapping. FR-020 forbids a hardcoded alias: `vercel deploy` without `--prod` mints a per-deployment host and moves no alias, so an alias names a host rather than the revision under test, and `cancel-in-progress: true` makes that a race.
- [x] **T039** Add the `e2e-preview-smoke` job: `name: E2E Preview Smoke`, `needs: [deploy-preview]`, `continue-on-error: true`, `timeout-minutes: 15`, with an `if:` guard requiring the captured deployment URL to be non-empty. It appears in no other job's `needs:`, and `deploy-preview` runs only on a `develop` push, so it can never surface as a pull-request check (FR-019, FR-023).
- [x] **T040** Give `e2e-preview-smoke` a bounded readiness poll that requests `${PLAYWRIGHT_BASE_URL}/` until it answers 200, capped well inside the 15-minute job timeout, so a cold deployment is a wait rather than a reported breakage (spec edge case).
- [x] **T041** Set the `e2e-preview-smoke` environment to exactly `PLAYWRIGHT_BASE_URL` from the `deploy-preview` output and `PLAYWRIGHT_SKIP_AUTH=true`, and nothing else. No database, no proxy sidecar, and neither `E2E_` gate — injecting the CI gates would defeat the point of testing the deployed configuration.
- [x] **T042** Set the `e2e-preview-smoke` test command to `npm run test:e2e -- --project=public-pages --project=accessibility-public --project=product-navigation --project=ai-stock-privacy --project=session-isolation --project=latest-features`, and upload `e2e-preview-smoke-report` with `if: always()` and 14-day retention. Exactly the six read-only projects from spec Q6; every project declaring a `storageState` and both writing projects are excluded (FR-021).

**Checkpoint**: On a `develop` push the lane runs against the URL that deployment emitted. On a fork pull request it does not appear at all.

---

## Phase 7: Documentation and enforcement (US1, US2)

**Purpose**: Satisfies FR-006, FR-012, FR-013, FR-018, and Story 2 acceptance 4.

- [x] **T043** [US1] In `docs/development.md`, document how to run, debug, and extend the suite locally: the single `npm run test:e2e` command, running a single project or file, `--headed` and `--ui`, where traces and the HTML report land, and how the CI production-build mode differs from the local development mode. (FR-012, FR-017)
- [x] **T044** [US1] In `docs/development.md`, publish the blocking/advisory/smoke classification for all seventeen live projects, together with the four criteria from spec Q4 and, for each advisory project, its tracked reason and its promotion condition. `orders-live`'s promotion condition is repairing its `tprod01` dependency and its conditional assertions; the two `ux-audit` projects' is defining a pass-or-fail contract. (FR-006, FR-018)
- [x] **T045** [US1] In `docs/development.md`, record the branch-protection enablement step and how to verify it: mark the check named exactly `End-to-End Suite` as required on `develop`, and verify by confirming a pull request reports it as required. `.github/` contains no ruleset file, so this cannot be delivered as a commit. (FR-013, SC-001)
- [x] **T046** [P] [US2] In `docs/features.md` line 32, drop the "localized" qualifier from the offline fallback claim — `src/app/(public)/offline/page.tsx` is English-only. (Story 2 acceptance 4)
- [x] **T047** [P] [US2] In `docs/features.md` line 53, reword the coverage claim so "responsive layouts" is no longer presented as enforced coverage, since `ux-audit.spec.ts` is confined to the advisory lane. FR-018 forbids counting an advisory suite as coverage; reword rather than delete.

---

## Phase 8: Validation

- [x] **T048** Run `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, and `npm run build`. All four are mandatory pre-PR gates and all four must pass.
- [ ] **T049** Run the blocking lane locally against a production build with the ephemeral database and confirm every blocking project passes on an unmodified checkout. (SC-002) **Executed — two lane-level defects fixed, one product defect still open.**
  - [x] **T049a** The strict edge limiter failed closed on `/api/auth/callback/credentials` because neither the lane nor CI provides Upstash credentials, so `global-setup.ts` could never sign in and every authenticated project aborted. `src/proxy.ts` now degrades strict paths to the in-memory window only when `E2E_ALLOW_INSECURE_HTTP=true` — the same opt-in flag that already allows plain HTTP — and keeps failing closed everywhere else.
  - [x] **T049b** The blob reporter derived its archive name from the fourteen `--project` flags and overflowed the 255-byte filename limit (`ENAMETOOLONG`), so no shard could publish a report. `playwright.config.ts` now names the archive `report-<shard>.zip` from `PLAYWRIGHT_SHARD_INDEX`, which `.github/workflows/build.yml` sets per shard.
  - [ ] **T049c** With sign-in restored the lane runs 149 cases: **107 passed, 37 failed, 5 skipped**. Every failure shares one root cause — the per-request nonce CSP in `src/proxy.ts` cannot apply to partially prerendered responses, so the browser blocks Next.js's inline hydration payload, React aborts with error #412, and any page whose content lives below a Suspense boundary (`/account`, admin, the register form, variant selection) stays at its empty shell. This is a product defect surfaced by the lane, not a test defect; it needs a CSP strategy compatible with the PPR work in `012-cache-components-and-ppr` and is out of scope for this feature.
- [x] **T050** Confirm the pull-request critical path stays within the 30-minute budget and the end-to-end job within 15 minutes, using the first real run's timings. (SC-006, FR-011) Full unsharded blocking lane: **4.4 min** of test execution, 268 s wall clock including the production server start. Migrate + seed + `npm run build` add ~4 min, so a single shard lands near 9 min and four parallel shards keep the end-to-end job well inside 15 min and the critical path inside 30 min.

---

## Dependencies

```text
Phase 1 (T001-T010)  ──┬──> Phase 4 (T022-T027)   T007 gates T025
                       ├──> Phase 5 (T028-T036)
                       └──> Phase 6 (T037-T042)
Phase 2 (T011-T015)  ─────> Phase 5              gates must exist before a job sets them
Phase 3 (T016-T021)  ─────> Phase 5              seed must exist before a job runs it
Phase 5              ─────> Phase 7 (T043-T045)  docs describe delivered jobs
Phase 6              ─────> Phase 7
All                  ─────> Phase 8 (T048-T050)
```

Phases 1, 2, and 3 are mutually independent and may proceed in parallel. Phase 6 depends on Phase 1 only through the repaired project definitions it selects.

## Parallel opportunities

- **T014** and **T015** — different test files, no shared state.
- **T022**, **T023**, **T024** — `latest-features.spec.ts` and `public-pages.spec.ts` are distinct files; T022 and T023 touch disjoint regions of the same file.
- **T035** is independent of T029-T034 once the shared setup-step shape is settled.
- **T046** and **T047** — distinct lines of `docs/features.md`.

## Traceability

| Requirement                       | Tasks                                    |
| --------------------------------- | ---------------------------------------- |
| FR-001, FR-003                    | T029, T036                               |
| FR-002                            | T001, T002, T009                         |
| FR-004                            | T032                                     |
| FR-005, SC-007                    | T004, T034, T036                         |
| FR-006, FR-018                    | T035, T044                               |
| FR-007, FR-008, SC-005            | T022, T023, T024, T026, T027             |
| FR-009                            | T005, T023, T025, T037                   |
| FR-010, FR-015, SC-008            | T031, T017                               |
| FR-011, SC-006                    | T029, T050                               |
| FR-012                            | T043                                     |
| FR-013, SC-001                    | T036, T045                               |
| FR-014, SC-010                    | T011-T021                                |
| FR-016, SC-009                    | T006, T007, T008, T010                   |
| FR-017                            | T009, T033, T035, T042                   |
| FR-019, FR-020, FR-021, FR-022    | T037-T042                                |
| FR-023                            | T039                                     |
| SC-002                            | T049                                     |
| SC-003                            | T005, T020                               |
| SC-004                            | T049                                     |
| SC-011                            | T039-T042                                |
