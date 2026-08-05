# Feature Specification: End-to-End Suite in Continuous Integration

**Feature Branch**: `013-e2e-in-continuous-integration`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 1 — Foundation: rendering model, CI truth, and stack modernization  
**Input**: Run the Playwright suite in CI on every pull request and repair the assertions that silently rotted while the suite was unenforced, so browser-level regressions are caught before merge.

## Baseline (verified 2026-08-01)

- `playwright-tests/` contains 16 spec files covering public pages, admin views, accessibility, cart, checkout policy and error recovery, orders, product navigation, variant options, AI stock privacy, password validation, and a UX screenshot audit.
- `.github/workflows/build.yml` defines exactly three jobs — `test` (lint, type check, unit tests with coverage), `build`, and `sonarqube`. **No job runs Playwright.** `azure-pipelines.yml` does not run it either.
- Because nothing enforces the suite, assertions have drifted from the product. `playwright-tests/latest-features.spec.ts` still asserts Spanish locale routing and a language switcher, both removed by the localization removal in PR #407.
- `playwright.config.ts` defines a project matrix including `desktop-chrome`, `mobile-chrome`, `admin-desktop`, and `admin-mobile`, with a global setup and shared mock data.
- The repository's mandatory pre-PR gates are `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build`; browser verification is documented as mandatory for UI changes but is not mechanically enforced.

### Re-verified 2026-08-04

- `.github/workflows/build.yml` now defines nine jobs — `test`, `build`, `sonarqube`, `deepsource`, `codecov`, `database-migrations-preview`, `database-migrations-production`, `deploy-preview`, and `deploy-production`. **Still none of them runs Playwright.** The 2026-08-01 count of three jobs is stale.
- Application source now lives under `src/`, so runtime paths are `src/lib/env.ts`, `src/lib/db.ts`, and `src/lib/redis.ts` rather than repository-root equivalents.
- `playwright.config.ts` declares **18** projects, three of which point at spec files that do not exist: `desktop-chrome` and `mobile-chrome` match `**/ui-changes.spec.ts`, and `locale-links` matches only `**/locale-links.spec.ts`. `playwright-tests/` still holds 16 spec files and every one of them is matched by some project.
- Localization rot is wider than first recorded. Beyond `latest-features.spec.ts`, `playwright-tests/public-pages.spec.ts` lines 30–31 still list `/es` and `/es/shop` in its static route table, and `playwright.config.ts` line 21 still probes `${BASE_URL}/en/shop` as the local server readiness check.
- `package.json` declares no `test:e2e` script; the suite is invoked as `npx playwright test`.
- `@playwright/test` is declared as `^1.62.0` and locked at `1.62.0`, which is the key the browser-binary cache required by FR-004 must use.

## Clarifications

### Session 2026-08-04

- **Q1**: How does the application obtain a database when the end-to-end suite runs in continuous integration?  
  **A**: Both mechanisms, for different reasons — the job provisions an ephemeral PostgreSQL instance for its own lifetime, applies the repository's committed migrations to it, and loads a committed fixture seed, while the blocking projects continue to intercept their browser-observable API traffic through the existing mock helpers.  
  **Rationale**: `src/lib/env.ts` validates `DATABASE_URL` at import time and `src/lib/db.ts` builds its connection pool from `env.DATABASE_URL` at module load, so no server-rendered route can render without a database, and Playwright route interception never reaches Server Component reads — mocks alone cannot remove the dependency, and a database alone cannot make assertions deterministic. Two consequences follow: `src/lib/db.ts` connects through `@neondatabase/serverless` (locked at `1.1.0`), which speaks a hosted WebSocket protocol rather than plain PostgreSQL wire protocol, so the ephemeral instance must be fronted by that driver's proxy configuration; and no cache service is provisioned, because `src/lib/redis.ts` returns `null` and falls through to the underlying fetcher when the Upstash variables are absent.
- **Q2**: How does CI obtain the admin session the eight authenticated projects need, and what happens on fork pull requests?  
  **A**: `playwright-tests/global-setup.ts` runs unchanged and signs in against the ephemeral CI database using an account created by the fixture seed; because that database is created and destroyed inside the job and holds only fixtures, its credentials are ordinary non-secret job values, so fork pull requests run exactly the same blocking set as branch pull requests.  
  **Rationale**: `global-setup.ts` reads plain `COPILOT_DEV_EMAIL` and `COPILOT_DEV_PASS` environment variables and only throws when both those variables and a cached state file are absent, and `.github/workflows/build.yml` already sets literal non-secret `DATABASE_URL` and `NEXTAUTH_SECRET` values for its `build` job, so this reuses an established pattern with no source change and no repository secret.
- **Q3**: What is the CI time budget referenced by FR-011 and SC-006, and how is the suite parallelized to meet it?  
  **A**: The end-to-end job completes within 15 minutes of wall-clock time and total pull-request CI stays within 30 minutes, achieved by splitting the blocking set across four parallel shards whose individual reports are merged into one, with an enforced job timeout above the budget.  
  **Rationale**: The suite declares 103 statically written cases across 16 files plus roughly 34 dynamically generated ones, and `playwright.config.ts` caps a test at 30 seconds (60 for `variant-options`), so a quarter of the blocking set fits inside 15 minutes with browser binaries cached per FR-004 and dependencies installed through the same `npm ci` path the existing jobs use.
- **Q4**: What criteria decide blocking versus advisory, and what is the initial classification of every declared project?  
  **A**: Four criteria decide it, and every declared project is assigned in the table below — fourteen blocking, five advisory, one removed. The advisory count rose from three to five because resolving the no-mixing rule split the admin screenshot audit out of `admin-desktop` and `admin-mobile` into its own pair of advisory projects.  
  **Rationale**: FR-006 requires a classification for every project, and an unstated rule cannot be applied to new projects or defended when a maintainer wants an inconvenient suite downgraded.
- **Q5**: Which artifacts outside the spec files must this feature deliver, and what does "required status check" concretely mean when branch protection is not a repository file?  
  **A**: Harness repair is in scope — project definitions whose patterns match no file are removed or repointed, the local server configuration supports both a development run and a CI production-build run with a readiness probe that targets a route that exists, and a single documented command runs the suite; enforcement is delivered as a stably named end-to-end job plus a recorded, verifiable enablement step against the default branch `develop`.  
  **Rationale**: The suite cannot run at all until `playwright.config.ts` line 21 stops probing the removed `/en/shop` route and its three dead project definitions are resolved, and `.github/` contains no ruleset or settings file, so protection can only be delivered as a nameable job plus a documented enablement step.

- **Q6**: Should the suite run against the deployed Vercel preview URL instead of a locally served production build?
  **A**: No for the gating lane, yes as an additional advisory post-deployment smoke lane that runs on `develop` pushes only, against the URL that deployment itself emits.
  **Rationale**: Six independently disqualifying facts block the deployed target from being the gate. (1) `.github/workflows/build.yml` gates `deploy-preview` on `github.ref == 'refs/heads/develop' && github.event_name == 'push'` and it `needs: [database-migrations-preview]`, which carries the same condition, so nothing in that path ever runs on a pull request; a suite hanging off it would run after merge and could not satisfy FR-001, FR-013, SC-001, or User Story 1. (2) That path reads `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`, none of which a fork pull request receives, against FR-010 and SC-008. (3) The preview database is long-lived and shared, so it can satisfy neither FR-014's ephemeral-migrate-seed requirement nor SC-003's ten identical runs — seeding it is destructive, and not seeding it makes `variant-options` and `product-navigation` depend on whatever rows happen to exist. (4) Against a deployed environment the `COPILOT_DEV_EMAIL` and `COPILOT_DEV_PASS` that `playwright-tests/global-setup.ts` reads stop being literal fixture values and become real administrator credentials for a real database, which FR-015 forbids. (5) `npx vercel deploy` without `--prod` mints a unique per-deployment URL and moves no project alias, so a hardcoded host such as `kiyontest.vercel.app` resolves to whatever revision that domain currently points at rather than the commit under test — and with `cancel-in-progress: true` concurrency that is a race, not a stable target. (6) `variant-options` and `orders-live` write through the real application path, so they must never touch a shared environment. What the deployed target does add, and what the local lane structurally cannot observe, is Vercel edge behavior, the genuine `src/proxy.ts` HTTPS path that the local lane deliberately suppresses through `E2E_ALLOW_INSECURE_HTTP`, Cache Components prerendering on the real runtime, and environment misconfiguration. That value is real but it is post-merge value, so it is delivered as a third lane rather than by weakening the gate.

The smoke lane carries the six projects that read without writing and depend on no fixture the deployed environment cannot be assumed to hold: `public-pages`, `accessibility-public`, `product-navigation`, `ai-stock-privacy`, `session-isolation`, and `latest-features`. Every project requiring `storageState` is excluded because it would need a real credential; `variant-options` and `orders-live` are excluded because they write; `cart`, `checkout-policy`, and `checkout-error-recovery` are excluded because they are meaningful only with interception, which would defeat the purpose of testing a deployment; the `ux-audit` screenshot heuristics are excluded because they have no pass-or-fail contract anywhere. A project's presence in both the blocking lane and the smoke lane is not a mixed classification: classification attaches to the gate a project feeds, and the smoke lane gates nothing.

Q4 applies four criteria. A project is blocking only when every browser-observable dependency is intercepted by the suite's own mocks or satisfied by the CI database and its seed; its assertions are deterministic, with no screenshot comparison, no timing or layout heuristic, and no reliance on data the seed does not guarantee; it needs no secret beyond the ephemeral test account, and any optional credential produces a skip rather than a failure; and it passes ten consecutive runs on an unmodified default-branch checkout. A project failing any of the first three criteria is advisory. A project failing only the fourth is quarantined into advisory with a tracked issue, per User Story 3. No project may mix blocking and advisory spec files, so the screenshot audit is confined to the advisory projects rather than riding along with `admin-views.spec.ts`.

| Project                       | Initial classification | Basis                                                                                                                                      |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ai-stock-privacy`            | Blocking               | Intercepts the assistant and exchange-rate calls and asserts a privacy invariant that does not depend on catalog contents.                 |
| `orders-list`                 | Blocking               | Every order and rate response is intercepted from the shared mock data.                                                                    |
| `latest-features`             | Blocking               | Deterministic once the removed localization assertions are gone.                                                                           |
| `password-validation-desktop` | Blocking               | Public form validation with no data dependency.                                                                                            |
| `account-password-validation` | Blocking               | Intercepts the account endpoint and needs only the seeded session.                                                                         |
| `admin-desktop`               | Blocking               | Every admin endpoint is intercepted from the shared mock data.                                                                             |
| `admin-mobile`                | Blocking               | Same coverage at the mobile viewport.                                                                                                      |
| `cart`                        | Blocking               | Stateful cart, checkout, and rate interception make it self-contained.                                                                     |
| `accessibility-public`        | Blocking               | Rule-based audit over a fixed route list, deterministic given deterministic markup.                                                        |
| `accessibility-authenticated` | Blocking               | Same audit using the seeded session.                                                                                                       |
| `product-navigation`          | Blocking               | Discovers product links at runtime, so it survives catalog changes.                                                                        |
| `public-pages`                | Blocking               | Deterministic once the removed locale routes are gone.                                                                                     |
| `session-isolation`           | Blocking               | Guards the Cache Components isolation invariant; its optional second-account case skips when that credential is absent.                    |
| `variant-options`             | Blocking               | Admitted only because the seed guarantees a product carrying variant options, and it fails loudly rather than silently when that is false. |
| `desktop-chrome`              | Advisory               | Reduces to screenshot and touch-target heuristics with no pass or fail contract once its dead pattern is dropped.                          |
| `mobile-chrome`               | Advisory               | Same heuristics at the mobile viewport.                                                                                                    |
| `ux-audit-admin-desktop`      | Advisory               | The same screenshot heuristics over admin routes, split out so no project mixes blocking and advisory spec files.                          |
| `ux-audit-admin-mobile`       | Advisory               | Same heuristics at the mobile viewport.                                                                                                    |
| `orders-live`                 | Advisory               | Writes through the real checkout path, depends on a product identifier no committed seed provides, and asserts conditionally.              |
| `locale-links`                | Removed                | Its only pattern matches a spec file that does not exist, and the behavior it guarded was removed with localization.                       |

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Pull requests are blocked by browser regressions (Priority: P1)

A contributor opening a pull request gets an automated end-to-end run whose failure blocks merge, so a change that breaks a real user journey cannot land.

**Why this priority**: This is the entire point of the feature. Every other story exists to make this signal trustworthy.

**Independent Test**: Open a pull request containing a deliberate regression to a covered journey and confirm the end-to-end job fails and is reported as a required check.

**Acceptance Scenarios**:

1. **Given** a pull request targeting the default branch, **When** CI runs, **Then** an end-to-end job executes the blocking Playwright projects against a production build.
2. **Given** a change that breaks a covered user journey, **When** the end-to-end job runs, **Then** the job fails and the pull request cannot be merged.
3. **Given** an end-to-end job failure, **When** a contributor inspects the run, **Then** traces, screenshots, and the HTML report are available as downloadable artifacts.
4. **Given** a passing pull request, **When** the end-to-end job completes, **Then** total CI wall-clock time remains within the agreed budget.

---

### User Story 2 - The suite asserts the product that exists today (Priority: P1)

Every assertion in the suite reflects current shipped behavior, so a failure always means a real regression rather than an obsolete expectation.

**Why this priority**: Turning on a suite that fails for historical reasons produces noise, and noisy required checks get bypassed. The suite must be green on the unmodified default branch before it can block anything.

**Independent Test**: Run the full suite against an unmodified checkout of the default branch and confirm every blocking project passes.

**Acceptance Scenarios**:

1. **Given** the localization feature was removed, **When** the suite runs, **Then** no test asserts locale-prefixed routes, a language switcher, or Spanish content.
2. **Given** an assertion that no longer matches shipped behavior, **When** it is found during the audit, **Then** it is either rewritten against current behavior or deleted with a recorded reason — never weakened to always pass.
3. **Given** the suite runs on the unmodified default branch, **When** all blocking projects execute, **Then** every one of them passes.
4. **Given** a suite covering a feature that no longer exists, **When** the audit completes, **Then** the file is removed and `docs/features.md` no longer claims coverage for it.

---

### User Story 3 - Deterministic runs distinguish flake from failure (Priority: P2)

The suite is stable enough that a red result is believed, and non-deterministic checks are separated from blocking ones.

**Why this priority**: A required check that fails intermittently trains contributors to re-run rather than investigate, which destroys the value delivered by Story 1.

**Independent Test**: Run the blocking projects repeatedly against an unchanged commit and confirm identical results on every run.

**Acceptance Scenarios**:

1. **Given** the blocking projects, **When** they are run repeatedly against the same commit, **Then** the pass or fail result is identical each time.
2. **Given** the screenshot-based UX audit suite, **When** CI runs, **Then** it executes in an advisory, non-blocking mode and its artifacts are published.
3. **Given** a test depending on external network services, **When** CI runs, **Then** the dependency is stubbed through the existing mock-data and route-interception helpers.
4. **Given** a test that fails intermittently, **When** it is identified, **Then** it is quarantined out of the blocking set with a tracked issue rather than left to erode the signal.

---

### Edge Cases

- The end-to-end job must not require production credentials; secrets absent on fork pull requests must not cause false failures.
- Admin-authenticated projects must obtain their session through the existing global setup, not through committed credentials.
- A build failure must fail fast and skip the end-to-end job rather than reporting a misleading browser error.
- Browser binary installation must be cached; a cache miss must slow the job rather than fail it.
- Advisory suites must never mark the workflow red, and blocking suites must never be silently downgraded to advisory.
- The application's data access layer targets a hosted database protocol, so an ephemeral CI database must be exposed in a form that layer accepts; otherwise every server-rendered route fails in a way that resembles an application regression rather than an environment fault.
- The CI database is created and destroyed inside the job, so no run may depend on data left behind by an earlier run, and a run must not be considered green because a fixture happened to survive.
- A project whose required fixture is missing from the seed must fail loudly during setup rather than skipping its assertions or passing vacuously.
- An advisory project that reports a problem by logging instead of failing must not be counted as coverage for the journey it walks through.
- The post-deployment smoke lane depends on a deployment credential that a fork pull request never receives. Its absence must leave the lane skipped rather than failed, so it can never turn a pull request red for a reason the contributor cannot act on.
- A deployment that is still warming when the smoke lane starts must be waited for within a bounded window rather than reported as a broken deployment.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `.github/workflows/build.yml` MUST define an end-to-end job that runs the Playwright suite on pull requests and on pushes to the default branch.
- **FR-002**: The end-to-end job MUST run against a production build of the application, matching the deployed rendering path. The test harness MUST support both that mode and a local development run, selected by environment rather than by editing the configuration, and its server readiness probe MUST target a route that exists in the current route tree.
- **FR-003**: The end-to-end job MUST depend on a successful build and MUST NOT run when the build fails.
- **FR-004**: Playwright browser binaries MUST be cached between runs, keyed on the Playwright version.
- **FR-005**: The job MUST publish the HTML report, traces, and failure screenshots as artifacts with a bounded retention period.
- **FR-006**: Every Playwright project MUST be explicitly classified as blocking or advisory against published criteria — dependencies fully satisfied by the CI environment or by the suite's own interception, deterministic assertions, and no reliance on an unavailable secret — and the classification MUST be recorded in the workflow and in `docs/development.md`. No project may mix blocking and advisory spec files.
- **FR-007**: All assertions referencing removed localization behavior MUST be deleted or rewritten against current behavior.
- **FR-008**: Every remaining spec file MUST be audited against current shipped behavior, and each obsolete assertion MUST be corrected or removed with a recorded reason.
- **FR-009**: Tests MUST NOT be weakened — removing assertions, widening matchers, or skipping cases to force a green run is prohibited.
- **FR-010**: The suite MUST run without production secrets. The end-to-end environment MUST be provisioned entirely from ephemeral, non-secret values so a pull request from a fork executes the same blocking set as a pull request from a branch in the repository, and any check that genuinely requires an unavailable secret MUST skip rather than fail.
- **FR-011**: Long-running suites MUST be parallelized or sharded so the end-to-end job completes within 15 minutes of wall-clock time, and the job MUST carry an enforced timeout above that budget so a hung run fails rather than idling.
- **FR-012**: `docs/development.md` MUST document how to run, debug, and extend the suite locally, including the blocking and advisory split.
- **FR-013**: The end-to-end job MUST carry a stable, unique name and MUST be enforced as a required status check for merges into the default branch. Because branch protection is not stored in the repository, the enablement step and the means of verifying it MUST be recorded in `docs/development.md`.
- **FR-014**: The end-to-end environment MUST provision an ephemeral database for the lifetime of the job, apply the repository's committed migrations to it, and load a committed deterministic seed. The seed MUST contain every fixture the blocking projects require, including at least one catalog product carrying variant options. The application MUST reach that database through its existing data access layer without altering production behavior.
- **FR-015**: Authenticated projects MUST obtain their session by signing in against the ephemeral CI database using an account created by that seed. Session state MUST NOT be committed to the repository, and the account's credentials MUST NOT be repository secrets.
- **FR-016**: Every Playwright project definition MUST resolve to at least one existing spec file; definitions whose patterns match no file MUST be removed or repointed.
- **FR-017**: A single documented command MUST run the suite, and CI MUST invoke that same command rather than a divergent one.
- **FR-018**: Advisory classification MUST NOT be used to retire coverage. An advisory project MUST still execute on every run, publish its artifacts, and carry a tracked reason and a condition for promotion into the blocking set.
- **FR-019**: A post-deployment smoke lane MUST run a named, read-only, non-mutating subset of the suite against the deployed preview environment after a successful deployment from the default branch, and it MUST NOT be the required pull-request status check.
- **FR-020**: The smoke lane's target MUST be the deployment URL emitted by the deployment step that produced the revision under test. A hardcoded project alias MUST NOT be used, because an alias identifies a host rather than a revision.
- **FR-021**: The smoke lane MUST NOT write to the shared preview database and MUST NOT require an account credential. Any project that declares a `storageState` or writes through the real application path is excluded from it, and the test harness MUST provide an explicit no-authentication mode rather than being fed placeholder credentials.
- **FR-022**: Smoke-lane execution MUST NOT be counted as coverage for any journey the blocking lane already owns, consistent with FR-018. The lane's purpose is to detect deployment-environment faults, not to substitute for the gate.
- **FR-023**: The smoke lane MUST skip cleanly when the deployment credential is unavailable, and MUST NOT fail for that reason.

### Key Entities

- **Playwright Project**: A named browser and viewport configuration in `playwright.config.ts`, classified as blocking or advisory.
- **Blocking Suite**: A spec file whose failure prevents merge.
- **Advisory Suite**: A spec file that produces artifacts and diagnostics without gating merge, such as the UX screenshot audit.
- **Suite Audit Record**: The per-file outcome of the assertion audit — retained, rewritten, or removed — with justification.
- **Fixture Seed**: The committed, deterministic data set loaded into the ephemeral CI database, defining the catalog, orders, and test account that blocking projects are allowed to rely on.
- **Smoke Lane**: The post-deployment run of a read-only project subset against the URL a deployment emitted. It gates nothing, holds no credential, and writes nothing.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The end-to-end job runs on every pull request into the default branch and appears as a required check.
- **SC-002**: The full blocking suite passes on an unmodified default-branch checkout.
- **SC-003**: Ten consecutive runs of the blocking suite against the same commit produce identical results.
- **SC-004**: A deliberately introduced regression in a covered journey is detected by the suite.
- **SC-005**: No test in the repository asserts localization behavior that was removed.
- **SC-006**: Total CI wall-clock time for a pull request stays within 30 minutes, and the end-to-end job itself completes within 15 minutes.
- **SC-007**: Failure artifacts for a failed run are downloadable and contain a trace for each failed test.
- **SC-008**: A pull request opened from a fork runs the same blocking set as one opened from a branch in the repository, with no blocking project skipped and no failure attributable to an unavailable secret.
- **SC-009**: Every Playwright project resolves to at least one existing spec file, and every project appears exactly once in the published blocking or advisory classification.
- **SC-010**: The blocking suite passes with no external service credentials configured, using only the database the job provisions, migrates, and seeds itself.
- **SC-011**: A preview deployment broken in a way the local lane cannot observe — an edge redirect, a prerendering fault, or an environment misconfiguration — is detected by the smoke lane within one run of the default-branch push that produced it.

## Out of Scope

- Adding new feature coverage beyond repairing existing suites; new journeys are covered by the specs that introduce them.
- Visual-regression baseline comparison for the screenshot audit.
- Load, performance, or soak testing.
- Promoting the post-deployment smoke lane into a gate, and running it against the production deployment. A check that fails after a production deploy is an alert rather than a gate and belongs with monitoring; promotion of the preview smoke lane is deferred until it has produced ten consecutive green runs.

## Dependencies

- Discharges a deferred obligation from `012-cache-components-and-ppr`, which has already landed. That feature's task T045 — run the full Playwright suite against a production build and record the result — was deferred to this feature because the suite is not runnable today, so `013` no longer blocks `012`; completing `013` satisfies T045.
- Guards the Cache Components rendering model that `012-cache-components-and-ppr` introduced. `playwright-tests/session-isolation.spec.ts` exists for exactly that purpose, and it is in the blocking set so a personalized response leaking into a prerendered shell fails the pull request rather than reaching production.
- Coordinates with `014-documentation-and-instruction-reconciliation` for the coverage claims in `docs/features.md`.
