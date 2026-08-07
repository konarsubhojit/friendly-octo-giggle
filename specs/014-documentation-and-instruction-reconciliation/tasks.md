---
description: 'Task list for reconciling documentation, instruction files, and specifications with the working tree'
---

# Tasks: Documentation and Instruction Reconciliation

**Input**: Design documents from `/specs/014-documentation-and-instruction-reconciliation/`  
**Prerequisites**: `plan.md` (required), `spec.md` (user stories)

**Tests**: Included, but narrowly. FR-016 forbids behavioral source changes, so the only testable artifact is the drift checker introduced in Phase 5; its rule functions get Vitest coverage at `__tests__/scripts/check-doc-drift.test.ts`. No existing test file is modified.

**Organization**: Tasks are grouped by user story so each story can be implemented, verified, and reviewed independently, in the priority order `plan.md` sets. Phases 2, 3, and 4 are independently mergeable; Phase 5 must land last.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task names the exact file it changes

## Baseline re-verification (2026-08-07)

`plan.md` R1–R9 were re-checked against the tree while writing this list. All findings hold, with one correction that changes the wording DR-001 and DR-002 require:

- **`scripts.dev` is `next dev --experimental-https`.** R2 records it as piping `node scripts/apply-idempotent-bootstrap.mjs` into `next dev`. It does not. `npm run dev` serves HTTPS (so DR-002 stands unchanged), but bootstrap is **not** run automatically, so DR-001's replacement prose must present `npm run db:bootstrap` as an explicit step, not as something `npm run dev` already does. T001 records this.

Confirmed unchanged: 17 defined scripts with no `db:seed` and no `dev:https`; 16 Markdown drift occurrences rather than the 18 `plan.md` counts — 12 `db:seed` (`README.md`, `docs/getting-started.md`, `docs/development.md`, `docs/deployment.md`, and `docs/troubleshooting.md` carry two each, both Copilot instruction files carry one each), 3 `dev:https` (`README.md`, `docs/development.md`, `.github/copilot-instructions.md`), and 1 nonexistent workflow; `.github/workflows/` contains only `build.yml` and `copilot-setup-steps.yml`; `__tests__/` contains 300 test files against the 87 claimed; `src/features/` has nine modules and `src/lib/` has the Inngest, search, and validations directories the constitution should name.

---

## Phase 1: Setup (Shared Ground Truth)

**Purpose**: Fix the replacement facts once, so four phases of prose corrections do not each invent their own wording. Produces no repository change beyond the correction ledger recorded in the PR description.

- [ ] T001 Record the corrected replacement facts in the PR description as the ledger every later task cites: `npm run dev` serves HTTPS with a self-signed certificate and there is no plain-HTTP dev script; `npm run db:bootstrap` (`scripts/apply-idempotent-bootstrap.mjs` plus `scripts/sql/`) is the supported initialization path and must be run explicitly; the only workflows are `.github/workflows/build.yml` and `.github/workflows/copilot-setup-steps.yml`.
- [ ] T002 [P] Enumerate every drift occurrence with `grep -rn "db:seed\|dev:https\|synthetic-uptests" --include="*.md" . --exclude-dir=node_modules` and paste the result into the PR description as the before-state; the same command must return only `specs/014-*` self-references after Phase 4.

**Checkpoint**: replacement wording is fixed and the before-state is captured.

---

## Phase 2: User Story 1 - A new contributor can set the project up by following the README (Priority: P1) 🎯 MVP

**Goal**: Every command in `README.md` and under `docs/` resolves to a script in `package.json`, and the described behavior matches what the script does.

**Independent Test**: On a clean checkout, execute every command in the README quick start in order and confirm each one resolves (SC-003).

### Implementation for User Story 1

- [ ] T003 [US1] In `README.md`, replace `npm run db:seed` in the Quick Start block (line 17) with `npm run db:bootstrap` and remove `npm run db:seed` from the development command list (line 105), describing `db:bootstrap` as idempotent database initialization (DR-001, FR-002).
- [ ] T004 [US1] In `README.md`, delete the `npm run dev:https` entry (line 98) and rewrite the `npm run dev` comment (line 94) to state that the dev server runs over HTTPS with an experimental self-signed certificate (DR-002, FR-003).
- [ ] T005 [P] [US1] In `docs/getting-started.md`, replace `npm run db:seed` at both occurrences (lines 87 and 173) with `npm run db:bootstrap` and correct the surrounding "seed test data" prose to describe idempotent bootstrap (DR-001).
- [ ] T006 [P] [US1] In `docs/development.md`, replace `npm run db:seed` (lines 25 and 66) with `npm run db:bootstrap`, delete the `npm run dev:https` line (57), and correct the `npm run dev` description to say HTTPS (DR-001, DR-002).
- [ ] T007 [P] [US1] In `docs/deployment.md`, replace `npm run db:seed` (line 170) and `railway run npm run db:seed` (line 332) with the `db:bootstrap` equivalents, confirming the surrounding deployment steps still read correctly (DR-001).
- [ ] T008 [P] [US1] In `docs/troubleshooting.md`, replace `npm run db:seed` (lines 238 and 1281) with `npm run db:bootstrap` and check that the remediation advice around each occurrence still matches what bootstrap does (DR-001).
- [ ] T009 [P] [US1] In `docs/observability.md`, remove the `.github/workflows/synthetic-uptests.yml` bullet (line 10) and replace it with a description of the monitoring actually configured — the `test`, `build`, `sonarqube`, DeepSource, and Codecov jobs in `.github/workflows/build.yml`, plus the Sentry configuration in `sentry.{client,server,edge}.config.ts` (DR-003, FR-004).
- [ ] T010 [US1] Verify `CONTRIBUTING.md` references no undefined script or workflow; it already uses `db:bootstrap` and is expected to be a no-op, so record the verification in the PR description rather than editing the file.
- [ ] T011 [US1] Walk the corrected README quick start end to end on a clean checkout and record each command's outcome, noting environment-only failures (missing `DATABASE_URL`, absent Redis) as acceptable per acceptance scenario 1 (SC-003).

**Checkpoint**: `grep -rn "db:seed\|dev:https\|synthetic-uptests"` returns nothing outside `.github/` and `specs/014-*`; the quick start executes.

---

## Phase 3: User Story 2 - Automated agents are briefed from the real architecture (Priority: P1)

**Goal**: The constitution and the single remaining Copilot instruction file name only modules, paths, and dependencies that exist.

**Independent Test**: Extract every file path from `.specify/memory/constitution.md` and `.github/copilot-instructions.md` and resolve each against the tree (SC-002).

### Implementation for User Story 2

- [ ] T012 [US2] In `.specify/memory/constitution.md`, rewrite Principle IV's background-work mandate: replace QStash (`lib/qstash.ts`, `lib/qstash-events.ts`), service endpoints under `app/api/services/`, Vercel Cron in `vercel.json`, and cron routes under `app/api/cron/` with the Inngest durable-function architecture — `src/lib/inngest/{client,dispatch,registry,realtime,sessions,scores}.ts` and `src/lib/inngest/functions/` (FR-005).
- [ ] T013 [US2] In `.specify/memory/constitution.md`, repoint the remaining module mandates: `lib/admin-auth.ts` → `src/features/admin/services/admin-auth.ts`, `lib/search.ts` and `lib/search-service.ts` → `src/lib/search/{client,index,product-search}.ts`, `lib/validations.ts` → `src/lib/validations/{index,api,env,payment,primitives}.ts` (FR-006).
- [ ] T014 [US2] In `.specify/memory/constitution.md`, prefix every surviving `lib/*` path with `src/` — `db.ts`, `redis.ts`, `auth.ts`, `logger.ts`, `api-utils.ts`, `api-middleware.ts`, `short-id.ts`, `edge-config.ts`, `cache-tags.ts` — so no path resolves only by guessing a root (R5, FR-006).
- [ ] T015 [US2] In `.specify/memory/constitution.md`, correct the Technology & Architecture Constraints currency clause (line 195) from "Prices stored in USD" to INR as the storage base, matching `src/lib/currency.ts` where INR has rate `1` and `formatPrice` takes `priceInINR` (FR-007).
- [ ] T016 [US2] In `.specify/memory/constitution.md`, correct the session strategy from NextAuth database sessions to JWT sessions, matching the `getToken` read in `src/proxy.ts` and the configuration in `src/lib/auth.ts` (FR-008).
- [ ] T017 [US2] In `.specify/memory/constitution.md`, set the version to **3.0.0**, update `Last Amended` to the merge date, and write the Sync Impact Report block at the head of the file enumerating each amended clause and the MAJOR rationale required by Governance clause 2 (DR-004, FR-009, SC-005).
- [ ] T018 [US2] In `.github/copilot-instructions.md`, replace the File Structure section with the `src/`-rooted layout: `src/app/`, `src/features/{account,admin,ai,auth,cart,orders,payments,product,wishlist}/`, `src/lib/`, `src/components/`, `src/contexts/`, `src/hooks/`, `src/server/`, `src/types/` (FR-010).
- [ ] T019 [US2] In `.github/copilot-instructions.md`, correct the Technology Stack and Commands Reference sections against `package.json`: the 17 defined scripts exactly, with no `db:seed` (line 455) and no `dev:https` (line 448), and `npm run dev` documented as HTTPS (FR-010, FR-001).
- [ ] T020 [US2] In `.github/copilot-instructions.md`, delete the hand-maintained test inventory table and replace it with a pointer to `__tests__/`, the current aggregate (300 files), and the command that reproduces the count, so the number can be re-derived rather than maintained (DR-005, FR-011).
- [ ] T021 [US2] Replace the body of `.github/copilot/instructions.md` with a pointer to `.github/copilot-instructions.md`, deleting the independent architecture restatement including its Prisma ORM v7 and ioredis claims and its `npm run db:seed` reference (line 230) (DR-006, FR-017, FR-018).
- [ ] T022 [US2] Resolve every path referenced by `.specify/memory/constitution.md` and `.github/copilot-instructions.md` against the tree and record the resolution list in the PR description; any unresolved path is a defect in T012–T020, not an acceptable residual (SC-002).
- [ ] T023 [US2] Confirm exactly one file states the project architecture for agent consumption and that every technology it names appears in `package.json` dependencies (SC-008).

**Checkpoint**: an agent loading either instruction surface receives only resolvable paths and installed dependencies.

---

## Phase 4: User Story 3 - Specifications describe the product that exists (Priority: P2)

**Goal**: No specification or documentation file presents localization as current behavior, and the removal is preserved as dated history.

**Independent Test**: Search the specification tree and `docs/features.md` for localization claims and confirm none present it as current (SC-004).

### Implementation for User Story 3

- [ ] T024 [US3] In `specs/011-current-platform-capabilities/spec.md`, add a dated superseded-history note to User Story 1 (line 11), acceptance scenarios 1–2 (lines 15–16), the localized offline scenario (line 18), the locale-safe checkout scenario (line 39), the unsupported-locale edge case (line 56), FR-001 and FR-002 (lines 65–66), and SC-001 (line 78), keeping the original text intact and recording that localization was removed in PR #407 (DR-009, FR-012).
- [ ] T025 [P] [US3] In `specs/README.md`, correct the rows for 001 and 011 so neither presents localization or locale-prefixed routing as shipped, and confirm every specification directory 001–023 is indexed with an accurate status, including the withdrawal note for 013 (FR-013).
- [ ] T026 [P] [US3] In `specs/README.md`, record that the localization assertions in `playwright-tests/latest-features.spec.ts` and the `/en/shop` probe in `playwright.config.ts` remain unrepaired and unowned, since the specification that owned the repair was withdrawn (R8, spec Dependencies).
- [ ] T027 [US3] Verify every capability claimed in `docs/features.md` is traceable to code in the working tree and confirm it contains no localization claim; expected to be a no-op, and the verification list belongs in the PR description (FR-014, R8).
- [ ] T028 [US3] Run `grep -rniE "locale|localization|language switcher|/en/" --include="*.md" specs docs README.md` and confirm every surviving hit is either dated history or an out-of-scope note, not a current-behavior claim (SC-004).

**Checkpoint**: the specification tree is a truthful record; history is preserved rather than erased.

---

## Phase 5: User Story 4 - Documentation drift is detected mechanically (Priority: P3)

**Goal**: A CI check fails when Markdown references an npm script or workflow file that does not exist.

**Independent Test**: Add a Markdown reference to a nonexistent npm script and confirm the check fails with file, line, and missing target (SC-006).

**⚠️ Ordering**: this phase must land only after Phases 2, 3, and 4 have cleared the existing violations. Introduced earlier it produces a red build that cannot distinguish new drift from old.

### Tests for User Story 4

- [ ] T029 [P] [US4] Add `__tests__/scripts/check-doc-drift.test.ts` covering a resolving `npm run` reference, a missing script, a missing workflow file, a block exempted by `<!-- doc-drift-ignore-next-block -->`, and proof the exemption does not leak into the block after the one it precedes; the file must sit under `__tests__/` to match the Vitest include glob (R9).

### Implementation for User Story 4

- [ ] T030 [US4] Create `scripts/check-doc-drift.mjs` as a Node 22 ESM script using only `node:fs` and `node:path`, exporting its rule functions for the unit tests and following the existing `scripts/apply-idempotent-bootstrap.mjs` convention (DR-007, FR-015).
- [ ] T031 [US4] Implement the script rule in `scripts/check-doc-drift.mjs`: every `npm run <script>` occurrence in Markdown must name a key in `package.json` `scripts`.
- [ ] T032 [US4] Implement the workflow rule in `scripts/check-doc-drift.mjs`: every `.github/workflows/<name>.yml` reference must resolve to a file on disk.
- [ ] T033 [US4] Implement the `<!-- doc-drift-ignore-next-block -->` exemption in `scripts/check-doc-drift.mjs`, scoped to the single fenced block that immediately follows the marker and to nothing else (DR-008).
- [ ] T034 [US4] Implement the reporting contract in `scripts/check-doc-drift.mjs`: one `path:line: <rule> — <missing target>` line per violation and a non-zero exit, or the scanned-file count and exit zero on a clean run (US4 acceptance scenario 3).
- [ ] T035 [US4] Restrict the scan in `scripts/check-doc-drift.mjs` to `*.md` outside `node_modules/` and `.next/`, and confirm it completes in under five seconds across all Markdown in the repository (plan Performance Goals).
- [ ] T036 [US4] Add `"docs:check": "node scripts/check-doc-drift.mjs"` to `package.json` scripts (DR-007).
- [ ] T037 [US4] Add a `Documentation drift check` step running `npm run docs:check` to the existing `test` job in `.github/workflows/build.yml`, placed after `Lint` so a failure is attributable; do not add a new job (DR-007, FR-015).
- [ ] T038 [US4] Run `npm run docs:check` against the corrected tree and confirm it exits zero, then add every exemption marker the remaining illustrative or third-party fences need, each with a trailing justification comment (DR-008, SC-001).
- [ ] T039 [US4] Push a deliberately bad reference on a scratch commit, observe the CI `test` job fail with the expected message, then revert it; record the run link in the PR description (SC-006).

**Checkpoint**: drift cannot be reintroduced silently.

---

## Phase 6: Polish and release gates

- [ ] T040 Run `npm run format:check` and, if it reports differences in any file this feature touched, run `npm run format` and re-check (plan Validation).
- [ ] T041 [P] Run `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, and `npm run build`; all four must pass unchanged, since this feature changes no application code (plan Validation).
- [ ] T042 Run `git diff --stat -- src/` and confirm it is empty (FR-016, SC-007).
- [ ] T043 Re-run the T002 grep and confirm the only surviving `db:seed`, `dev:https`, and `synthetic-uptests` hits are inside `specs/014-*`, which describes the drift and must retain the names (SC-001).
- [ ] T044 Assemble the PR description from the ledger (T001), the before/after greps (T002, T043), the path-resolution list (T022), the features verification (T027), and the CI failure evidence (T039).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; can start immediately.
- **User Story 1 (Phase 2)**: depends on T001 for the replacement wording.
- **User Story 2 (Phase 3)**: depends on T001; independent of Phase 2 and can run in parallel with it — the file sets do not overlap.
- **User Story 3 (Phase 4)**: independent of Phases 2 and 3 and can run in parallel with both.
- **User Story 4 (Phase 5)**: **depends on Phases 2, 3, and 4 completing**, because the checker must be introduced against a clean tree.
- **Polish (Phase 6)**: depends on all preceding phases.

### Within Each User Story

- T003–T009 are one-file-each corrections with no ordering constraint; T010 and T011 are verification and run last in Phase 2.
- The constitution edits T012–T016 must all precede T017, since the Sync Impact Report enumerates them.
- The instruction-file edits T018–T020 must precede T021, so the pointer target is already correct when the duplicate collapses.
- In Phase 5, the rule tasks T031–T034 build on the T030 skeleton; T036 and T037 follow the working script; T038 and T039 verify it.

### Parallel Opportunities

- Phases 2, 3, and 4 are mutually independent and can be taken by three contributors simultaneously.
- T005, T006, T007, T008, and T009 touch five different files under `docs/`.
- T025 and T026 both touch `specs/README.md` and must **not** be parallelized with each other despite the `[P]` on each; they are marked `[P]` only relative to T024 and T027.
- T029 can be written alongside T030.

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Fix the replacement facts (T001–T002).
2. Correct the contributor-facing commands (T003–T011).
3. **STOP and VALIDATE**: execute the README quick start on a clean checkout.

### Incremental Delivery

1. Phase 2 → the setup path works; the most damaging drift is gone.
2. Phase 3 → agents stop being briefed from a stale map, which is the drift with the highest blast radius per session.
3. Phase 4 → specifications become a truthful planning input.
4. Phase 5 → the correction is locked in mechanically.

### Parallel Team Strategy

1. Everyone reads T001 first.
2. Developer A takes Phase 2, Developer B takes Phase 3, Developer C takes Phase 4.
3. Whoever finishes first takes Phase 5, which starts only after all three merge.

---

## Notes

- [P] tasks touch different files and have no ordering constraint between them.
- FR-016 is the hard boundary: no task in this list may change a file under `src/`, and T042 proves it.
- The Playwright localization assertions and the `/en/shop` probe in `playwright.config.ts` are knowingly left broken; `013-e2e-in-continuous-integration` was withdrawn on 2026-08-07 and no specification currently owns the repair. T026 records this rather than fixing it.
- Where a document and the code disagree, the code is authoritative — every correction in this list moves the document.
- `plan.md` R2 misstates `scripts.dev`; the Baseline re-verification section above supersedes it, and T001 carries the corrected wording into every dependent task.
