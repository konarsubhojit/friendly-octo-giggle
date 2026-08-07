# Implementation Plan: Documentation and Instruction Reconciliation

**Branch**: `014-documentation-and-instruction-reconciliation` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/014-documentation-and-instruction-reconciliation/spec.md`

## Summary

Bring every operating contract — `README.md`, `docs/`, `.specify/memory/constitution.md`, the Copilot instruction files, and the specification index — back into agreement with the working tree, then add a mechanical drift check to `package.json` and CI so the agreement cannot silently decay again.

The work is documentation-only by design (FR-016): the code is authoritative, so wherever a document and the implementation disagree, the document is corrected. The single new executable artifact is the drift checker, a standalone Node script under `scripts/` that reads Markdown and `package.json` and writes no application code.

## Technical Context

**Language/Version**: Markdown; Node.js 22 ESM for the drift checker (matching `scripts/apply-idempotent-bootstrap.mjs`)  
**Primary Dependencies**: None new. The checker uses only Node built-ins (`node:fs`, `node:path`).  
**Storage**: N/A  
**Testing**: Vitest (`__tests__/**/*.test.ts`) for the checker's pure rule functions; the checker itself is exercised in CI  
**Target Platform**: GitHub Actions `ubuntu-latest`, plus local developer machines  
**Project Type**: Web application (Next.js 16.3, React 19.2, Drizzle 0.45, Upstash Redis 1.38, Inngest 4.13)  
**Performance Goals**: The drift check completes in under five seconds across all 122 Markdown files so it can be a cheap CI step  
**Constraints**: No change may land under `src/` (FR-016, SC-007); the constitution amendment must follow its own Governance process (FR-009)  
**Scale/Scope**: 122 Markdown files, 1 constitution, 2 Copilot instruction files, 9 files under `docs/`, 23 specification directories

## Constitution Check

_GATE: evaluated 2026-08-07 against `.specify/memory/constitution.md` v2.0.0._

| Principle                              | Assessment                                                                                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Server-First Rendering              | Not engaged. No rendering code changes.                                                                                                                                                                                 |
| II. Type Safety End-to-End             | Engaged only by the drift checker. It is a `.mjs` script outside the type-checked project, consistent with the existing `scripts/apply-idempotent-bootstrap.mjs` precedent; its rule functions are unit tested instead. |
| III. Testing Discipline                | Satisfied. The checker's rule functions get unit tests; the checker's own failure mode is proven by a deliberately bad reference (SC-006).                                                                              |
| IV. Serverless & Caching Architecture  | **This feature amends it.** The principle currently mandates QStash and Vercel Cron, neither of which exists. Amendment is the deliverable, not a violation.                                                            |
| V. Security by Default                 | Engaged indirectly. The admin-auth mandate points at a nonexistent module; correcting it strengthens the rule rather than relaxing it.                                                                                  |
| VI. Observability & Structured Logging | Not engaged beyond correcting the synthetic-uptest reference in `docs/observability.md`.                                                                                                                                |
| VII. Simplicity & YAGNI                | Satisfied. The checker is deliberately two rules, no dependencies, no configuration file.                                                                                                                               |
| VIII. DRY Shared Utilities             | Engaged. `.github/copilot-instructions.md` and `.github/copilot/instructions.md` are near-duplicates that have diverged; the plan collapses the duplication instead of correcting both copies.                          |

**Gate result**: PASS. The one principle touched is touched by amendment, through the process the constitution itself defines.

## Phase 0 — Research findings (verified 2026-08-07 against the working tree)

The spec's baseline was recorded on 2026-08-01. Every claim in it was re-verified today, and three findings were added.

### R1 — Missing scripts, confirmed and counted

`package.json` defines: `dev`, `analyze`, `build`, `start`, `lint`, `lint:strict`, `format`, `format:check`, `db:generate`, `db:migrate`, `db:bootstrap`, `redis:orders:index`, `db:push`, `db:studio`, `test`, `test:watch`, `test:coverage`.

| Referenced script | Occurrences in Markdown | Exists | Files                                                                                                                                          |
| ----------------- | ----------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `db:seed`         | 13                      | No     | `README.md`, `docs/getting-started.md`, `docs/development.md`, `docs/deployment.md`, `docs/troubleshooting.md`, both Copilot instruction files |
| `dev:https`       | 4                       | No     | `README.md`, `docs/development.md`, `.github/copilot-instructions.md`                                                                          |

Every other referenced script resolves.

### R2 — `npm run dev` already serves HTTPS

`scripts.dev` is `node scripts/apply-idempotent-bootstrap.mjs | next dev --experimental-https`. The documented "plain `dev` vs. HTTPS `dev:https`" distinction is therefore inverted, exactly as the spec states. There is no plain-HTTP dev script at all.

### R3 — Seeding has a real replacement

`scripts/apply-idempotent-bootstrap.mjs` and `scripts/sql/` provide idempotent bootstrap, exposed as `npm run db:bootstrap` and already run as part of `npm run dev`. This is the supported alternative FR-002 asks for; no seed script needs to be written.

### R4 — The nonexistent workflow

<!-- doc-drift-ignore-next-block --> <!-- Records the nonexistent workflow this feature removed; naming it is the point. -->

`docs/observability.md:10` cites `.github/workflows/synthetic-uptests.yml`. `.github/workflows/` contains only `build.yml` and `copilot-setup-steps.yml`. `build.yml` runs on `push` to `develop`/`master` and on pull requests, with jobs `test`, `build`, `sonarqube`, DeepSource, and Codecov.

### R5 — Constitution path drift is broader than the spec recorded

Beyond the nonexistent modules the spec lists, **every** path in the constitution omits the `src/` root. Paths that resolve only after prefixing: `lib/db.ts`, `lib/redis.ts`, `lib/auth.ts`, `lib/logger.ts`, `lib/api-utils.ts`, `lib/api-middleware.ts`, `lib/short-id.ts`, `lib/edge-config.ts`, `lib/cache-tags.ts`. Paths with no counterpart at any root: `lib/qstash.ts`, `lib/qstash-events.ts`, `lib/admin-auth.ts`, `lib/search.ts`, `lib/search-service.ts`, `lib/validations.ts`, `app/api/cron/`, `app/api/services/`, `vercel.json`.

Real replacements, all confirmed present: `src/lib/inngest/{client,dispatch,registry,realtime,sessions,scores}.ts` and `src/lib/inngest/functions/`, `src/features/admin/services/admin-auth.ts`, `src/lib/search/{client,index,product-search}.ts`, `src/lib/validations/{index,api,env,payment,primitives}.ts`.

### R6 — A second, worse instruction file (new finding)

`.github/copilot/instructions.md` is a near-duplicate of `.github/copilot-instructions.md` and is further out of date: it names **Prisma ORM v7** and **ioredis**, neither of which is a dependency. The tree uses Drizzle 0.45 and `@upstash/redis` 1.38. The spec's FR-010 and FR-011 address only `.github/copilot-instructions.md`, so this file would be left stale. See the spec-delta section below.

### R7 — The test inventory is quantitatively wrong (new detail)

`.github/copilot-instructions.md` claims a total of **87 test files**. `__tests__/` contains **300**. The table also lists pre-`src/` paths such as `lib/features/cart/cartSlice.ts`, while the real layout is `src/features/{account,admin,ai,auth,cart,orders,payments,product,wishlist}/`. This confirms FR-011's judgment that a hand-maintained inventory cannot be kept true.

### R8 — Localization claims survive in specifications, not in `docs/features.md` (new detail)

`docs/features.md` contains no localization claim and needs verification only, not correction. The surviving claims are in `specs/011-current-platform-capabilities/spec.md` (its User Story 1, acceptance scenarios 1-2, edge case on unsupported locales, FR-001, SC-001) and in the `specs/README.md` rows for 001 and 011. `playwright-tests/latest-features.spec.ts` still asserts Spanish routing; repairing it is out of scope here because FR-016 forbids touching test code in this change set and the specification that owned the repair was withdrawn.

### R9 — Formatting and tooling context

Prettier is configured (`.prettierrc.json`) and `npm run format:check` covers Markdown. There is no Markdown linter, so the drift checker must not attempt style enforcement. Vitest includes only `__tests__/**/*.test.{ts,tsx}`, so the checker's unit tests belong at `__tests__/scripts/check-doc-drift.test.ts`.

## Decisions

| ID     | Decision                                                                                                                                                        | Rationale                                                                                                                                                   | Rejected alternative                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| DR-001 | Resolve `db:seed` by **removing the references** and documenting `npm run db:bootstrap` as the supported path.                                                  | The capability already exists under a different name and already runs inside `npm run dev`. Writing a second seeding mechanism would violate Principle VII. | Adding a `db:seed` script — duplicates `db:bootstrap` and creates two competing initialization stories. |
| DR-002 | Resolve `dev:https` by **removing the references** and stating that `npm run dev` serves HTTPS with a self-signed certificate.                                  | Matches `scripts.dev` exactly; no plain-HTTP variant exists to document.                                                                                    | Adding a `dev:https` alias — an alias to the only dev command is noise.                                 |
| DR-003 | Resolve the synthetic-uptest reference by **removing it** from `docs/observability.md` and describing the monitoring that is actually configured.               | Adding a synthetic-uptest workflow is a behavior change in a documentation-only change set, and no one has specified its targets or alerting.               | Adding the workflow — out of scope per FR-016 and the spec's Out of Scope section.                      |
| DR-004 | Amend the constitution to **version 3.0.0**.                                                                                                                    | Governance clause 2 requires MAJOR for principle redefinition. Principle IV's background-jobs mandate is being replaced wholesale (QStash → Inngest).       | 2.1.0 — understates a mandate replacement and would set a precedent for quiet principle rewrites.       |
| DR-005 | Replace the hand-maintained test inventory in the Copilot instructions with a pointer to `__tests__/` plus the current aggregate count and how to reproduce it. | 87 claimed versus 300 actual proves the table cannot be maintained. FR-011 explicitly permits the pointer.                                                  | Regenerating the table — correct for one day, then wrong again.                                         |
| DR-006 | **Collapse `.github/copilot/instructions.md`** into a pointer to `.github/copilot-instructions.md` rather than correcting both files.                           | Two divergent copies of one operating contract is the drift mechanism itself; Principle VIII forbids it.                                                    | Correcting both — doubles maintenance and guarantees they diverge again.                                |
| DR-007 | Implement the drift check as `scripts/check-doc-drift.mjs`, exposed as `npm run docs:check`, wired into the existing `test` job in `build.yml`.                 | Reuses the established `scripts/*.mjs` pattern and the existing job, so CI wall-clock cost is a few seconds and no new job matrix is introduced.            | A new CI job — adds queue time and a second required check for a sub-second task.                       |
| DR-008 | Give the checker an explicit opt-out marker (`<!-- doc-drift-ignore-next-block -->`) immediately preceding a fenced block, rather than heuristics.              | The spec's last edge case requires illustrative and third-party commands to be exemptible without false failures; an explicit marker is auditable.          | Inferring intent from fence language or surrounding prose — unpredictable, and silently over-exempts.   |
| DR-009 | Record `specs/011`'s localization content as **superseded history with a dated note**, keeping the original text.                                               | FR-012 and the spec's edge case both require traceability; deleting the text erases why the tests were written.                                             | Deleting the sections — destroys the audit trail that explains the stale Playwright assertions.         |

## Drift check design (FR-015)

**Artifact**: `scripts/check-doc-drift.mjs`, plus `npm run docs:check`.

**Inputs**: every `*.md` outside `node_modules/` and `.next/`; `package.json` scripts; the contents of `.github/workflows/`.

**Rules**:

1. **Script rule** — every `npm run <script>` occurrence must name a key in `package.json` `scripts`.
2. **Workflow rule** — every `.github/workflows/<name>.yml` path reference must resolve to a file on disk.

**Exemption**: a `<!-- doc-drift-ignore-next-block -->` comment exempts the fenced block that immediately follows it. Nothing else is exempt. Every use must carry a trailing justification comment.

**Output**: one line per violation as `path:line: <rule> — <missing target>`, then a non-zero exit. A clean run prints the number of files scanned and exits zero.

**Deliberately not implemented**: source-path validation across all Markdown. The constitution and the Copilot instructions are corrected by hand under FR-005, FR-006, and FR-010 and re-verified by SC-002; generalizing path checking to every specification would fail on historical documents that correctly describe a past layout, which DR-009 requires be preserved.

**Testing**: `__tests__/scripts/check-doc-drift.test.ts` covers a resolving reference, a missing script, a missing workflow, an exempted block, and the exemption not leaking into the following block. SC-006 is proven separately by pushing a deliberately bad reference and observing CI fail.

## Project Structure

### Documentation (this feature)

```text
specs/014-documentation-and-instruction-reconciliation/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Produced by /speckit.tasks — not created here
```

### Files this feature changes

```text
README.md                                   # DR-001, DR-002: quick start and command list
CONTRIBUTING.md                             # Verify command references only
docs/getting-started.md                     # DR-001
docs/development.md                         # DR-001, DR-002, verify layout description
docs/deployment.md                          # DR-001
docs/troubleshooting.md                     # DR-001
docs/observability.md                       # DR-003
docs/features.md                            # FR-014 verification pass; expected no-op
.specify/memory/constitution.md             # FR-005 to FR-009, DR-004; version 2.0.0 -> 3.0.0
.github/copilot-instructions.md             # FR-010, FR-011, DR-005
.github/copilot/instructions.md             # DR-006: collapse to a pointer
specs/011-current-platform-capabilities/spec.md   # FR-012, DR-009
specs/README.md                             # FR-013
scripts/check-doc-drift.mjs                 # FR-015 (new)
__tests__/scripts/check-doc-drift.test.ts   # FR-015 tests (new)
package.json                                # docs:check script (new)
.github/workflows/build.yml                 # DR-007: one step in the existing test job
```

**Structure Decision**: No directory is created. The checker follows the existing `scripts/*.mjs` convention and its tests follow the existing `__tests__/` mirror convention. `src/` is untouched, which is the assertion SC-007 makes.

## Delivery phases

Each phase is independently mergeable and independently verifiable, in the priority order the spec sets.

| Phase | Story    | Scope                                                                                                                                                             | Verified by                                                              |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1     | US1 (P1) | `README.md`, `docs/getting-started.md`, `docs/development.md`, `docs/deployment.md`, `docs/troubleshooting.md` — DR-001, DR-002; `docs/observability.md` — DR-003 | Execute the README quick start end to end on a clean checkout (SC-003)   |
| 2     | US2 (P1) | Constitution amendment (FR-005 to FR-009, DR-004) and the Copilot instruction files (FR-010, FR-011, DR-005, DR-006)                                              | Resolve every path referenced by those files against the tree (SC-002)   |
| 3     | US3 (P2) | `specs/011` superseded-history note, `specs/README.md` index, `docs/features.md` verification                                                                     | Search the specification tree for localization claims (SC-004)           |
| 4     | US4 (P3) | `scripts/check-doc-drift.mjs`, its unit tests, `docs:check`, the CI step                                                                                          | Deliberately bad reference fails CI (SC-006); clean tree passes (SC-001) |

Phase 4 must run last so it is introduced against an already-clean tree; introducing it first would produce a red build with no way to distinguish new drift from old. The current tree has eighteen violations: thirteen `db:seed`, four `dev:https`, and one nonexistent workflow.

## Spec deltas applied by this plan

Research findings R6 and R7 fell outside the spec's original requirement list. Planning added them to `spec.md`:

- **FR-017**: `.github/copilot/instructions.md` MUST NOT restate the architecture independently; it MUST defer to `.github/copilot-instructions.md`, so a single instruction surface exists.
- **FR-018**: No instruction file may name a dependency the project does not have — `.github/copilot/instructions.md` currently names Prisma ORM and ioredis, and neither is installed.

Corresponding measurable outcome:

- **SC-008**: Exactly one file in the repository states the project architecture for agent consumption, and every technology it names is present in `package.json`.

## Risks

| Risk                                                                                       | Mitigation                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| The drift check produces false failures on illustrative commands and blocks unrelated work | DR-008's explicit marker; Phase 4 lands only after Phases 1-3 have cleared the real violations                                                      |
| A constitution amendment silently changes an engineering rule beyond the drift correction  | Each amended clause is a one-for-one replacement of a nonexistent module with its real counterpart; the Sync Impact Report enumerates them (FR-009) |
| Documentation is corrected toward what a reader assumes rather than what the code does     | Every correction cites the file that proves it, as in R1-R8 above; the code is authoritative per the spec's Out of Scope section                    |
| Scope creeps into repairing the Playwright suite                                           | Explicitly excluded by FR-016 and R8; the suite's localization assertions remain unowned and are recorded as such in `specs/README.md`              |

## Rollback

Every phase is a documentation-only commit and reverts cleanly in isolation. Phase 4 is the only phase that can fail CI for a subsequent contributor; reverting the `docs:check` step in `build.yml` disarms it without touching any corrected prose.

## Validation

- `npm run format:check` — Markdown formatting, all phases
- `npm run docs:check` — after Phase 4, must exit zero
- `npm test` — the checker's unit tests
- `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm run build` — required pre-PR gates, expected to be unaffected
- `git diff --stat -- src/` — must be empty (SC-007)

## Complexity Tracking

> No Constitution Check violation requires justification. The one principle affected is amended through its own Governance process, which DR-004 documents.
