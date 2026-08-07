# Feature Specification: Documentation and Instruction Reconciliation

**Feature Branch**: `014-documentation-and-instruction-reconciliation`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 1 — Foundation: rendering model and stack modernization  
**Input**: Reconcile the README, `/docs`, the project constitution, the agent instruction files, and the spec index with the code that actually exists, so contributors and automated agents stop being briefed from a stale map.

## Baseline (verified 2026-08-01)

Documented instructions have drifted materially from the implementation. Each of the following was confirmed against the working tree:

**Commands that do not exist**

- `npm run db:seed` is referenced by `README.md`, `docs/getting-started.md`, `docs/development.md`, `docs/deployment.md`, and `docs/troubleshooting.md`. `package.json` defines no such script.
- `npm run dev:https` is referenced by `README.md` and `docs/development.md`. No such script exists; `npm run dev` already runs `next dev --experimental-https`, so the documented HTTP/HTTPS distinction is inverted.

**Files and workflows that do not exist**

- `docs/observability.md` cites `.github/workflows/synthetic-uptests.yml`. The repository contains only `build.yml` and `copilot-setup-steps.yml`.
- `.specify/memory/constitution.md` mandates QStash via `lib/qstash.ts`, `lib/qstash-events.ts`, service endpoints under `app/api/services/`, Vercel Cron Jobs in `vercel.json`, cron routes under `app/api/cron/`, `checkAdminAuth` from `lib/admin-auth.ts`, `lib/search.ts`, `lib/search-service.ts`, and Zod schemas in `lib/validations.ts`. **None of these paths exist.** Background work now runs on Inngest (`src/lib/inngest/`), admin auth lives in `src/features/admin/services/admin-auth.ts`, search lives in `src/lib/search/`, and validations live in `src/lib/validations/`.

**Facts stated backwards**

- The constitution states prices are stored in USD and converted for display. `src/lib/currency.ts` defines INR as the base with rate `1`, and `formatPrice` takes `priceInINR`.
- The constitution specifies NextAuth database sessions. `src/proxy.ts` reads a JWT via `getToken`, and `docs/features.md` correctly describes JWT sessions.
- `.github/copilot-instructions.md` documents a pre-`src/` layout with `lib/features/*` Redux slices and a test-file inventory table that no longer matches `__tests__/`.

**Superseded specification content**

- `specs/011-current-platform-capabilities/spec.md` and `specs/README.md` still present localization and locale-prefixed routing as shipped behavior. That feature was removed in PR #407.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A new contributor can set the project up by following the README (Priority: P1)

Someone cloning the repository can reach a running local application by executing the documented commands in order, without encountering a command that does not exist.

**Why this priority**: A setup path that fails on its own instructions is the first and most damaging impression, and it blocks every subsequent contribution.

**Independent Test**: On a clean checkout, execute every command in the README quick start in order and confirm each one resolves and completes.

**Acceptance Scenarios**:

1. **Given** a clean clone, **When** a contributor runs each documented setup command in order, **Then** every command exists in `package.json` and completes or fails only for a documented environment reason.
2. **Given** the documentation describes seeding, **When** a contributor follows it, **Then** either a real seed script is provided or the seeding step is removed and replaced with the supported alternative.
3. **Given** the documentation describes running the dev server, **When** a contributor follows it, **Then** the described protocol matches what `npm run dev` actually does.
4. **Given** any documented command, **When** an automated check runs, **Then** every `npm run <script>` referenced in Markdown resolves to a script defined in `package.json`.

---

### User Story 2 - Automated agents are briefed from the real architecture (Priority: P1)

An agent operating under `.github/copilot-instructions.md` and the project constitution receives directory paths, module names, and architectural rules that match the working tree.

**Why this priority**: These files are loaded as an operating contract on every session. Stale mandates actively cause wrong work — an agent told to import `checkAdminAuth` from `lib/admin-auth.ts` will create a duplicate module rather than reuse the real one.

**Independent Test**: Extract every file path and module reference from the instruction files and the constitution, and confirm each one resolves in the repository.

**Acceptance Scenarios**:

1. **Given** the constitution, **When** its referenced paths are resolved, **Then** every path exists or the rule is rewritten against the module that replaced it.
2. **Given** the constitution mandates QStash and Vercel Cron, **When** it is amended, **Then** it describes Inngest durable functions and the registry in `src/lib/inngest/registry.ts`.
3. **Given** the constitution states prices are stored in USD, **When** it is amended, **Then** it states INR as the storage base consistent with `src/lib/currency.ts`.
4. **Given** the constitution states database sessions, **When** it is amended, **Then** it states JWT sessions consistent with `src/proxy.ts` and `src/lib/auth.ts`.
5. **Given** `.github/copilot-instructions.md` documents a pre-`src/` layout, **When** it is amended, **Then** it describes the `src/app`, `src/features`, `src/lib`, and `src/components` structure and the current dependency set.
6. **Given** the constitution is amended, **When** the change is committed, **Then** its version is incremented with a documented rationale as its own governance section requires.

---

### User Story 3 - Specifications describe the product that exists (Priority: P2)

The specification index and the platform capability specification no longer assert removed features, so specifications remain a trustworthy record of intended behavior.

**Why this priority**: Specifications drive acceptance tests and feature planning. Claiming a removed capability perpetuates dead test assertions, such as the localization expectations still present in `playwright-tests/latest-features.spec.ts`.

**Independent Test**: Search the specification tree and `docs/features.md` for localization claims and confirm none remain.

**Acceptance Scenarios**:

1. **Given** localization was removed, **When** the specification tree is searched, **Then** no specification presents locale-prefixed routing or a language switcher as current behavior.
2. **Given** `specs/011` documented localization as shipped, **When** it is revised, **Then** the removal is recorded as history rather than silently deleted, preserving traceability.
3. **Given** `specs/README.md`, **When** it is updated, **Then** it lists every specification including the new Phase 1 through Phase 3 entries with accurate status.
4. **Given** `docs/features.md`, **When** it is verified, **Then** every claimed capability is traceable to code in the working tree.

---

### User Story 4 - Documentation drift is detected mechanically (Priority: P3)

A check prevents the reintroduction of references to commands, scripts, and workflow files that do not exist.

**Why this priority**: Without enforcement this reconciliation decays again. It is P3 because the one-time correction delivers most of the value and the guard protects it afterward.

**Independent Test**: Add a Markdown reference to a nonexistent npm script and confirm the check fails.

**Acceptance Scenarios**:

1. **Given** a Markdown file references `npm run <script>`, **When** the check runs, **Then** it fails if the script is absent from `package.json`.
2. **Given** documentation references a workflow file under `.github/workflows/`, **When** the check runs, **Then** it fails if the file does not exist.
3. **Given** the check fails, **When** a contributor reads the output, **Then** the message names the offending file, line, and missing target.

---

### Edge Cases

- A documented command that is genuinely desirable but missing (such as database seeding) must be resolved by a recorded decision — implement it or remove the claim — never by leaving the reference in place.
- Historical specifications must not be rewritten to erase what was once true; superseded behavior is recorded as history with a date.
- The constitution's own governance rules require a version increment and rationale, so amending it must follow its stated process.
- Documentation referencing external services that are optional at runtime must state the degraded behavior rather than implying the service is required.
- The drift check must not produce false failures for code fences that intentionally show illustrative or third-party commands.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every `npm run <script>` reference in Markdown MUST resolve to a script defined in `package.json`.
- **FR-002**: The `db:seed` references MUST be resolved by either adding a working seed script or removing the references and documenting the supported alternative.
- **FR-003**: The `dev:https` references MUST be corrected to describe the actual behavior of `npm run dev`.
- **FR-004**: `docs/observability.md` MUST either stop referencing a nonexistent synthetic uptest workflow or the workflow MUST be added.
- **FR-005**: `.specify/memory/constitution.md` MUST replace QStash, Vercel Cron, and `app/api/cron/` mandates with the Inngest durable-function architecture actually in use.
- **FR-006**: The constitution MUST reference `src/features/admin/services/admin-auth.ts`, `src/lib/search/`, and `src/lib/validations/` instead of the nonexistent `lib/admin-auth.ts`, `lib/search.ts`, `lib/search-service.ts`, and `lib/validations.ts`.
- **FR-007**: The constitution MUST state INR as the stored price base, matching `src/lib/currency.ts`.
- **FR-008**: The constitution MUST state NextAuth JWT sessions, matching `src/proxy.ts` and `src/lib/auth.ts`.
- **FR-009**: The constitution MUST be amended with a semantic version increment and a documented rationale, as its Governance section requires.
- **FR-010**: `.github/copilot-instructions.md` MUST describe the `src/`-rooted directory layout, the `src/features/*` module structure, the current dependency set, and the current command list.
- **FR-011**: The test-coverage inventory in `.github/copilot-instructions.md` MUST either match `__tests__/` or be replaced with a pointer to the directory so it cannot drift again.
- **FR-012**: `specs/011-current-platform-capabilities/spec.md` MUST record the localization removal as superseded history rather than presenting it as current behavior.
- **FR-013**: `specs/README.md` MUST index every specification with an accurate status and MUST group the new work by phase.
- **FR-014**: `docs/features.md` MUST be verified so that every claimed capability is traceable to code in the working tree.
- **FR-015**: An automated check MUST fail when documentation references a nonexistent npm script or workflow file, and it MUST run in CI.
- **FR-016**: No behavioral source code may change in this work; changes are limited to documentation, specifications, instruction files, and the drift check.
- **FR-017**: `.github/copilot/instructions.md` MUST NOT restate the architecture independently; it MUST defer to `.github/copilot-instructions.md`, so a single instruction surface exists.
- **FR-018**: No instruction file may name a dependency the project does not have — `.github/copilot/instructions.md` currently names Prisma ORM and ioredis, and neither is installed.

### Key Entities

- **Instruction Surface**: A file consumed as an operating contract — `.github/copilot-instructions.md`, `.specify/memory/constitution.md`, and `.github/instructions/*`.
- **Documentation Surface**: `README.md`, `CONTRIBUTING.md`, and the files under `docs/`.
- **Specification Surface**: `specs/README.md` and each `specs/NNN-*/spec.md`.
- **Drift Assertion**: A documented claim — a command, path, or workflow reference — that can be mechanically checked against the working tree.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every `npm run <script>` reference across all Markdown files resolves to a defined script.
- **SC-002**: Every file path referenced by the constitution and `.github/copilot-instructions.md` exists in the working tree.
- **SC-003**: A new contributor can complete the README quick start without encountering a missing command.
- **SC-004**: No specification or documentation file presents localization as current behavior.
- **SC-005**: The constitution version is incremented and its Sync Impact Report records the rationale.
- **SC-006**: The drift check runs in CI and fails on a deliberately introduced bad reference.
- **SC-007**: `git diff` for this work contains no changes under `src/`.
- **SC-008**: Exactly one file in the repository states the project architecture for agent consumption, and every technology it names is present in `package.json`.

## Out of Scope

- Rewriting documentation for readability or restructuring the `docs/` information architecture.
- Adding documentation for features that do not yet exist; the specs that introduce them own their documentation.
- Changing runtime behavior to match documentation — where they disagree, the code is authoritative.

## Dependencies

- None. `013-e2e-in-continuous-integration`, which would have repaired the test-side consequences of the same localization drift, was withdrawn on 2026-08-07; this work records the drift in documentation and specifications but does not repair the Playwright suite.
- Should land before Phase 2 so subsequent feature work is planned from an accurate architectural description.
