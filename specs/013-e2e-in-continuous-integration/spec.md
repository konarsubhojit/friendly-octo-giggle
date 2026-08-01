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

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `.github/workflows/build.yml` MUST define an end-to-end job that runs the Playwright suite on pull requests and on pushes to the default branch.
- **FR-002**: The end-to-end job MUST run against a production build of the application, matching the deployed rendering path.
- **FR-003**: The end-to-end job MUST depend on a successful build and MUST NOT run when the build fails.
- **FR-004**: Playwright browser binaries MUST be cached between runs, keyed on the Playwright version.
- **FR-005**: The job MUST publish the HTML report, traces, and failure screenshots as artifacts with a bounded retention period.
- **FR-006**: Every Playwright project MUST be explicitly classified as blocking or advisory, and the classification MUST be recorded in the workflow and in `docs/development.md`.
- **FR-007**: All assertions referencing removed localization behavior MUST be deleted or rewritten against current behavior.
- **FR-008**: Every remaining spec file MUST be audited against current shipped behavior, and each obsolete assertion MUST be corrected or removed with a recorded reason.
- **FR-009**: Tests MUST NOT be weakened — removing assertions, widening matchers, or skipping cases to force a green run is prohibited.
- **FR-010**: The suite MUST run without production secrets and MUST skip, not fail, any check that genuinely requires an unavailable secret.
- **FR-011**: Long-running suites MUST be parallelized or sharded so the end-to-end job stays within the documented CI time budget.
- **FR-012**: `docs/development.md` MUST document how to run, debug, and extend the suite locally, including the blocking and advisory split.
- **FR-013**: The end-to-end job MUST be configured as a required status check for merges into the default branch.

### Key Entities

- **Playwright Project**: A named browser and viewport configuration in `playwright.config.ts`, classified as blocking or advisory.
- **Blocking Suite**: A spec file whose failure prevents merge.
- **Advisory Suite**: A spec file that produces artifacts and diagnostics without gating merge, such as the UX screenshot audit.
- **Suite Audit Record**: The per-file outcome of the assertion audit — retained, rewritten, or removed — with justification.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The end-to-end job runs on every pull request into the default branch and appears as a required check.
- **SC-002**: The full blocking suite passes on an unmodified default-branch checkout.
- **SC-003**: Ten consecutive runs of the blocking suite against the same commit produce identical results.
- **SC-004**: A deliberately introduced regression in a covered journey is detected by the suite.
- **SC-005**: No test in the repository asserts localization behavior that was removed.
- **SC-006**: Total CI wall-clock time for a pull request stays within the documented budget.
- **SC-007**: Failure artifacts for a failed run are downloadable and contain a trace for each failed test.

## Out of Scope

- Adding new feature coverage beyond repairing existing suites; new journeys are covered by the specs that introduce them.
- Visual-regression baseline comparison for the screenshot audit.
- Load, performance, or soak testing.

## Dependencies

- Blocks `012-cache-components-and-ppr`, which changes the rendering model and needs a trustworthy browser-level signal.
- Coordinates with `014-documentation-and-instruction-reconciliation` for the coverage claims in `docs/features.md`.
