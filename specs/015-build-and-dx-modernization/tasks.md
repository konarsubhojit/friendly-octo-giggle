---
description: 'Task list for enabling React Compiler, typed routes, the Turbopack filesystem cache, and package-import optimization'
---

# Tasks: Build and Developer Experience Modernization

**Input**: Design documents from `/specs/015-build-and-dx-modernization/`  
**Prerequisites**: `plan.md` (required), `spec.md` (user stories)

**Tests**: Included, but almost entirely as _verification of unchanged behavior_ rather than new coverage. This feature adds no product behavior; its risk is regression, so the existing Vitest and Playwright suites are the instrument. One new suite is required (T031) to make a memoized module eligible for removal.

**Organization**: Tasks are grouped by user story so each capability can be implemented, measured, and reverted independently (FR-006).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task names the exact file it changes

## Phase 1: Setup (Measurement Baseline)

**Purpose**: Record the numbers every later claim is compared against. Nothing here changes shipped code, so it can land first and independently. Skipping this phase makes FR-009, FR-010, SC-003 and SC-004 unprovable.

- [x] T001 Record the cold build baseline: `rm -rf .next`, then `npm run build`, capturing wall-clock time and the route table into the Measurement protocol table in `plan.md`. Name the machine and cache state.
- [x] T002 Record the warm build baseline: run `npm run build` again immediately, with `.next/cache/turbopack` populated, and add it to the same table.
- [x] T003 [P] Record cold and warm dev-startup baselines: time `npm run dev` to the "Ready" line with `.next` removed, then again after a restart, into the same table.
- [x] T004 [P] Record the bundle baseline with `npm run analyze` and capture per-route first-load JS from the analyzer report into `plan.md` — the 16.3 build table no longer prints size columns (`plan.md` R9).
- [x] T005 [P] Confirm `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test` and `npm run build` all pass on the untouched tree, so any later failure is attributable to this feature.

**Checkpoint**: every "before" number in `plan.md` is filled in and the tree is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: There is no shared foundation to build — the four capabilities are independent by design (FR-006). This phase exists only to fix the ordering contract.

- [x] T006 Confirm the capability order in the `plan.md` Capability inventory is the implementation order (typed routes → React Compiler → CI cache key → package imports), and that each capability will be its own commit so it can be reverted alone (FR-006, SC-007).

**Checkpoint**: user story work can begin; US2 first because it is the cheapest and carries no runtime risk.

---

## Phase 3: User Story 2 - Invalid internal links fail at compile time (Priority: P1) 🎯 MVP

**Goal**: A mistyped internal route is a type error, not a production 404.

**Independent Test**: Change an internal route reference to a route that does not exist and confirm `npx tsc --noEmit -p tsconfig.check.json` reports an error; revert.

### Implementation for User Story 2

- [x] T007 [US2] Set `typedRoutes: true` at the **top level** of `next.config.ts` — not under `experimental`, where it is deprecated in 16.3 (`plan.md` R3).
- [x] T008 [P] [US2] Type the `href` prop as `Route` (imported from `next`) in `src/components/ui/CtaButton.tsx` (line 16).
- [x] T009 [P] [US2] Type the route values forwarded to `Link` in `src/components/ui/RouteErrorCard.tsx` (lines 97, 137).
- [x] T010 [P] [US2] Type the breadcrumb item `href` in `src/features/admin/components/AdminBreadcrumbs.tsx` (line 26).
- [x] T011 [P] [US2] Type the nav-item `href` used by `Link` and `router.push` in `src/features/admin/components/AdminNavLinksClient.tsx` (lines 258, 343, 467).
- [x] T012 [P] [US2] Type the checkout step `href` in `src/features/cart/components/CheckoutProgress.tsx` (line 43).
- [x] T013 [P] [US2] Type the `router.push` target and the reset `href` in `src/features/product/components/ProductGrid.tsx` (lines 559, 802).
- [x] T014 [US2] Add the single permitted escape hatch in `src/app/(public)/products/[id]/ProductClient.tsx` (line 81), where `usePathname()` returns `string` and a same-page query-string update cannot be statically typed. Comment it with the reason and keep it to that one call site (US2 acceptance 3, FR spec edge case forbidding widespread casting).
- [x] T015 [US2] Run `npx tsc --noEmit -p tsconfig.check.json` and confirm zero errors (FR-002, from the 11 recorded in the `plan.md` defect table).
- [x] T016 [US2] Prove the feature works: temporarily point one internal `href` at a nonexistent route, confirm the type check fails, revert, and record the evidence in the PR description (SC-002).
- [x] T017 [US2] Run `npm run lint`, `npm test` and `npm run build`; confirm no route-related runtime change.

**Checkpoint**: route typos are compile-time failures and the four gates pass. This capability is complete and revertable on its own.

---

## Phase 4: User Story 1 - Automatic memoization replaces hand-written memo wrappers (Priority: P1)

**Goal**: The compiler memoizes client components, so re-render correctness no longer depends on hand-placed dependency arrays.

**Independent Test**: Enable the compiler, build, run the unit and Playwright suites, and confirm interactive surfaces behave identically.

### Enablement

- [x] T018 [US1] Add `babel-plugin-react-compiler` to `devDependencies` in `package.json` via `npm install --save-dev babel-plugin-react-compiler` — the build aborts with an explicit resolution error without it, which is how FR-001's "fail loudly" clause is satisfied (`plan.md` R4). It is build-time only and never reaches the browser.
- [x] T019 [US1] Set `reactCompiler: true` at the **top level** of `next.config.ts` (`plan.md` R2). Do not enable `experimental.turbopackRustReactCompiler`; it is out of scope.
- [x] T020 [US1] Run `npm run build` and confirm it succeeds; record the compile-step and total-build delta against the T002 baseline in `plan.md` (`plan.md` R5 measured +6.5 s warm in the sandbox — re-measure here).
- [x] T021 [US1] Run `npm test` and confirm every previously passing suite still passes (US1 acceptance 2).
- [ ] T022 [US1] Run the Playwright suite against a production build and confirm it passes with the compiler on (SC-005).
- [x] T023 [US1] Collect compiler bailouts and fill the bailout register in `plan.md` — one row per component with its reason and memoization disposition. Use the `eslint-plugin-react-hooks` compiler diagnostics already active through `npm run lint` (`plan.md` R11), plus build output. An empty register is a valid result and must be stated explicitly (SC-006, US1 acceptance 3).

### Memoization removal — one module per commit, covered modules only

> Each task below is its own commit. After each, `npm run lint` and `npm test` must pass. A new `react-hooks/preserve-manual-memoization` diagnostic means the removal was unsafe: revert it, never suppress it (FR-007).

- [x] T024 [US1] Remove manual `useMemo`/`useCallback` from `src/hooks/` — `useCursorPagination.ts`, `useFetch.ts`, `useFormState.ts`, `useLocalStorage.ts`, `useModalState.ts`, `useMutation.ts` — verifying against `__tests__/hooks/`.
- [x] T025 [US1] Review `src/contexts/CurrencyContext.tsx` and `src/contexts/ThemeContext.tsx` for consumers that depend on the context value's referential identity **before** removing anything (spec edge case), then remove where safe, verifying against `__tests__/contexts/`.
- [x] T026 [US1] Remove manual memoization from `src/features/product/components/` (`BestsellersScroller`, `ImageCarousel`, `ProductGrid`, `ProductSearch`, `ReviewsSection`, `ShareButton`) and `src/features/product/hooks/useRecentlyViewed.ts`, verifying against the product suites under `__tests__/`.
- [x] T027 [US1] Remove manual memoization from `src/features/admin/components/` (`AdminNavLinksClient`, `CategoriesClient`, `OptionManager`, `VariantFormModal`, `VariantList`), verifying against the admin suites.
- [x] T028 [US1] Remove manual memoization from `src/app/(public)/account/` (`AccountClient`, `NotificationsSection`, `PasswordSection`, `PreferencesSection`, `ProfileSection`), verifying against the account suites.
- [ ] T029 [US1] Skip `src/features/admin/components/CouponsClient.tsx` — it is the one memoized module with no referencing suite (`plan.md` R10). Record the skip and its reason in `plan.md`.
- [ ] T030 [US1] Leave manual memoization in place in every component listed in the bailout register (FR-008), and state that in the register rather than implying it.
- [ ] T031 [P] [US1] _Optional, unblocks T029_: add `__tests__/features/admin/components/CouponsClient.test.tsx` covering the component's rendering and coupon interactions, then remove its memoization under the same rule as every other module.

**Checkpoint**: the compiler is on, all suites pass, the bailout register is filled, and each removal is an isolated commit.

---

## Phase 5: User Story 3 - Builds and dev startup are measurably faster (Priority: P2)

**Goal**: Cached compilation work is reused locally and in CI, and the CI cache key describes reality.

**Independent Test**: Compare warm build and dev restart against the T001–T003 baselines on the same machine and commit.

- [ ] T032 [US3] Verify — do not re-declare — that `turbopackFileSystemCacheForDev` and `turbopackFileSystemCacheForBuild` are already `true` by default in 16.3, and record the verification in `plan.md`. Adding the flags to `next.config.ts` would restate a default and create a second source of truth (`plan.md` R6, Principle VII). If a future Next.js release changes the default, this decision is revisited then.
- [ ] T033 [US3] Confirm the measured cold→warm improvement against the T001/T002 baselines and record it (SC-003, US3 acceptances 1 and 2).
- [ ] T034 [US3] Rewrite the `Restore Next.js build cache` key in `.github/workflows/build.yml` to hash `package-lock.json` and `next.config.ts` only, dropping the `app/**` and `pages/**` globs that name directories deleted in the move to `src/` and dropping the whole-source hash that changes the key on every commit (FR-005, `plan.md` CI cache key).
- [ ] T035 [US3] Apply the identical key to the `Save Next.js build cache` step in `.github/workflows/build.yml` so restore and save cannot drift.
- [ ] T036 [US3] Confirm the cached path `.next/cache` covers `.next/cache/turbopack` (verified at 352 MB on this tree) and record the confirmation; no path change is needed (FR-005).
- [ ] T037 [US3] Verify graceful degradation: corrupt or delete `.next/cache/turbopack` and confirm `npm run build` falls back to a cold build and produces identical output rather than failing (US3 acceptance 4, spec edge case "correctness outranks speed").
- [ ] T038 [US3] Record the CI build-job duration before and after the key change from the workflow run summaries in `.github/workflows/build.yml`, and note whether the exact-match restore now hits.

**Checkpoint**: cache behavior is measured, the CI key is honest, and a corrupt cache degrades instead of breaking.

---

## Phase 6: User Story 4 - Client bundles carry only what they use (Priority: P3)

**Goal**: Heavy client dependencies are imported at module granularity — but only where measurement shows it matters.

**Independent Test**: Compare `npm run analyze` output before and after; no affected route bundle may grow.

- [ ] T039 [US4] Confirm from `package.json` metadata which candidate packages are already tree-shakeable: `zenput`, `d3-array`, `d3-scale` and `d3-shape` all declare `"sideEffects": false` and ship ESM (`plan.md` R8). Record the finding — it is the reason this story may end up adding nothing.
- [ ] T040 [US4] Record that `@upstash/search-ui` is imported nowhere under `src/` (`plan.md` R8), so it is an unused dependency rather than a bundling problem. Do not remove it under this feature; note it for a dependency cleanup instead (out of scope per the spec).
- [ ] T041 [US4] Note that `experimental.turbopackInferModuleSideEffects` already defaults to `true` in 16.3 and may make `optimizePackageImports` redundant for these packages; the measurement in T042 decides.
- [ ] T042 [US4] Add `experimental.optimizePackageImports` to `next.config.ts` listing only the packages actually imported by client code (`zenput`, `d3-array`, `d3-scale`, `d3-shape`), run `npm run analyze`, and compare per-route first-load JS against the T004 baseline.
- [ ] T043 [US4] Keep in the list only packages the T042 comparison shows reduce a bundle; remove the rest so the configuration does not carry inert entries (Principle VII, FR-004). If nothing improves, remove the option entirely and record that outcome as the result.
- [ ] T044 [US4] Confirm no listed package has import side effects (FR-004, spec edge case) using the `"sideEffects"` metadata recorded in T039.
- [ ] T045 [US4] Run `npm test` and confirm behavior is unchanged (US4 acceptance 2), and record both bundle measurements in `plan.md` (US4 acceptance 3, FR-010).

**Checkpoint**: bundle composition is measured before and after, and no route bundle grew (SC-004).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T046 Document the enabled build capabilities in `docs/development.md`: which flags are on, which are on by default and deliberately not re-declared, and why (FR-012).
- [ ] T047 Document the memoization policy under the compiler in `docs/development.md`: do not add `useMemo`/`useCallback` by hand; if a component needs one, that is a signal to check the bailout register (FR-012).
- [ ] T048 Document how to clear a corrupt Turbopack cache (`rm -rf .next/cache/turbopack`) and what to expect afterwards, in `docs/development.md` (FR-012).
- [ ] T049 Document the typed-routes contract in `docs/development.md`: route props are typed as `Route`, and `as` casts are not the remedy for a type error — a wrong route string is.
- [ ] T050 Run all five gates one final time — `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, `npm run build`, `npm run docs:check` — with every capability enabled (FR-011, SC-001).
- [ ] T051 Verify SC-007 by checking out each capability commit and reverting it in isolation, confirming the other three still build and pass.
- [ ] T052 Update `specs/README.md` to move 015 from "Proposed; not planned" to its post-implementation status.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; must complete first or the success criteria become unprovable.
- **Foundational (Phase 2)**: an ordering contract only; no code.
- **US2 (Phase 3)**: independent. Cheapest, zero runtime risk, so it goes first.
- **US1 (Phase 4)**: independent of US2. T018 → T019 → T020–T023 are strictly sequential; the removal tasks T024–T028 each depend on T019 and on T023 (the register tells you what not to touch).
- **US3 (Phase 5)**: independent of US1 and US2. T034 and T035 must land together — a restore key that disagrees with the save key never hits.
- **US4 (Phase 6)**: depends on T004 for its baseline; otherwise independent.
- **Polish (Phase 7)**: after every capability that is going to land has landed.

### Parallel Opportunities

- T003, T004, T005 in parallel.
- T008–T013 in parallel — six different files, one shared config flag already set by T007.
- T024–T028 are **not** parallel by policy: one module per commit, verified before the next begins (FR-007).
- US2, US3 and US4 can proceed in parallel with US1's enablement if staffed, since they touch disjoint files.

---

## Implementation Strategy

### MVP (US2 only)

1. Phase 1 baseline → Phase 2 ordering → Phase 3.
2. Stop and validate: a mistyped route fails the type check, four gates pass.
3. This alone is shippable and removes a whole class of production defect.

### Incremental Delivery

1. US2 → typed routes, own PR, own revert.
2. US1 enablement (T018–T023) → own PR; memoization removals follow as separate commits.
3. US3 → cache measurement plus the CI key fix, own PR.
4. US4 → only if the measurement in T042 justifies it; otherwise the recorded null result is the deliverable.

---

## Notes

- The spec's baseline was written against Next.js 16.2.11; the tree runs 16.3.0. Where the two disagree, `plan.md` Phase 0 records the probe result and it governs.
- Absolute timings in `plan.md` are sandbox measurements. Only same-machine, same-commit deltas are meaningful; re-measure locally before quoting anything in a PR.
- Every task that says "record" means write it into `plan.md`, not into a PR comment that disappears.
- No task in this feature changes a data path, an API contract, or an auth check.
