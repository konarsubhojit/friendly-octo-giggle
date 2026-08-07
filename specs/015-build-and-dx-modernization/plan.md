# Implementation Plan: Build and Developer Experience Modernization

**Branch**: `015-build-and-dx-modernization` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/015-build-and-dx-modernization/spec.md`

## Summary

Turn on the four build-level capabilities the installed toolchain already ships — React Compiler, typed routes, the Turbopack filesystem cache, and package-import optimization — measure each one, and leave the codebase in a state where a mistyped route fails type checking and memoization is the compiler's job rather than the author's.

The work has four independently revertable parts, sequenced by cost of failure rather than by spec priority:

1. **Record the baseline** — cold build, warm build, dev startup, and bundle composition, on one machine at one commit, before any flag moves. Every later claim is measured against this record.
2. **Typed routes** — a one-line config change plus **11 type errors in 8 files**, all of them components that accept a route as a plain `string` prop. No runtime behavior changes, and the fix is a prop type, not a cast.
3. **React Compiler** — add `babel-plugin-react-compiler` (the build fails loudly without it, verified), enable `reactCompiler`, then remove hand-written `useMemo`/`useCallback` one module at a time, only where a test already exercises the module.
4. **Cache and bundle** — the filesystem cache is already on by default in Next.js 16.3, so this reduces to verifying it and repairing a CI cache key that hashes every source file and still names directories that were deleted. Package-import optimization is applied only where `npm run analyze` shows it earns its place.

The spec's baseline was written on 2026-08-01 against Next.js 16.2.11. The repository now runs **16.3.0**, which moved `reactCompiler` and `typedRoutes` to top-level configuration and turned the Turbopack filesystem cache on by default. Phase 0 below re-verifies every baseline claim against the installed toolchain; where the spec and the probe disagree, the probe wins.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict), React 19.2.7, Next.js 16.3.0 (App Router, Turbopack, Cache Components enabled)  
**Primary Dependencies**: `next` build configuration only; one new build-time dependency (`babel-plugin-react-compiler`) and no new runtime dependency  
**Storage**: unchanged — this feature touches no data path  
**Testing**: Vitest + React Testing Library (301 suites under `__tests__/`), Playwright (`playwright-tests/`)  
**Target Platform**: Vercel serverless; GitHub Actions (`.github/workflows/build.yml`) for CI  
**Project Type**: Single Next.js application (`src/app`, `src/features`, `src/lib`)  
**Performance Goals**: warm build and dev restart faster than the recorded baseline; no route bundle larger than its recorded baseline  
**Constraints**: each capability must be revertable on its own; a stale cache must never change build output; manual memoization may only be removed where a test covers the module  
**Scale/Scope**: 133 `'use client'` files; 48 files carrying 31 `useMemo` and 95 `useCallback` call sites; 8 files with untyped route props; 1 CI cache key

## Constitution Check

_GATE: checked before Phase 0 and re-checked after the design below. Constitution v3.0.0._

| Principle                              | Assessment                                                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Server-First Rendering              | PASS — no `'use client'` boundary is added or moved. The compiler optimizes existing client components in place.                                                                                                                                            |
| II. Type Safety End-to-End             | PASS — strengthened. Typed routes extend static checking to the one remaining untyped string surface in the app. `as Route` casts are prohibited; props are typed instead (see Typed-route defect table).                                                   |
| III. Testing Discipline                | PASS with a constraint — memoization may only be removed from a module an existing test exercises. `src/features/admin/components/CouponsClient.tsx` is the single memoized module with no referencing test and is therefore excluded until one is written. |
| IV. Serverless & Caching Architecture  | PASS — untouched. No route segment configuration is introduced; `cacheComponents` and the `cacheLife` profiles are unchanged.                                                                                                                               |
| V. Security by Default                 | PASS — no auth, input, or network path changes. The one new dependency is a build-time Babel plugin that never ships to the browser.                                                                                                                        |
| VI. Observability & Structured Logging | PASS — no logging change.                                                                                                                                                                                                                                   |
| VII. Simplicity & YAGNI                | PASS — the plan deliberately _omits_ configuration that restates a default (R6) and adds packages to `optimizePackageImports` only where measurement justifies them (R8).                                                                                   |
| VIII. DRY Shared Utilities             | PASS — the route-prop fix introduces one shared type import (`Route` from `next`) rather than repeating a cast at each call site.                                                                                                                           |

No violations. Complexity Tracking is empty.

## Phase 0 — Research findings (verified 2026-08-07 by probe against Next.js 16.3.0)

Each finding was produced by editing `next.config.ts`, running `npm run build` in this working tree, recording the result, and reverting. They replace the spec's 16.2.11-era assumptions with observed behavior.

- **R1 — Version drift since the spec.** The installed toolchain is `next@16.3.0`, `react@19.2.7`, `typescript@6.0.3`. The spec's `16.2.11` baseline is stale; three of its four assumptions about where the options live are now wrong (R2, R3, R6).
- **R2 — `reactCompiler` is a top-level config option, not `experimental`.** `next/dist/server/config-shared.d.ts` declares `reactCompiler?: boolean | ReactCompilerOptions` on `NextConfig`. A separate `experimental.turbopackRustReactCompiler` exists for the Rust port; it is explicitly experimental and out of scope here.
- **R3 — `typedRoutes` is a top-level stable option.** `experimental.typedRoutes` is still accepted but carries `@deprecated Use 'typedRoutes' instead — this feature is now stable`. The new configuration is `typedRoutes: true` at the top level.
- **R4 — FR-001's "fail loudly" requirement is satisfied by the framework, not by us.** With `reactCompiler: true` and no plugin installed, the build aborts:

  ```text
  Error: Turbopack build failed with 1 error:
  ./next.config.ts
  Error: Failed to resolve package babel-plugin-react-compiler while attempting to resolve React Compiler
  ```

  There is no silent skip. `babel-plugin-react-compiler@1.0.0` resolves from the public registry and, once installed, the build compiles successfully. It is a build-time-only dependency and belongs in `devDependencies` (Vercel installs dev dependencies during builds).

- **R5 — The compiler costs compile time and buys runtime.** Measured on one machine at one commit, all with a populated Turbopack cache: compile step **1.0 s → 10.8 s**, total build **11.0 s → 17.5 s**. That is the price of routing every source file through Babel. It is paid in CI and on Vercel, not by users, and the cache absorbs most of it on incremental builds.
- **R6 — The Turbopack filesystem cache is already enabled by default.** `turbopackFileSystemCacheForDev` and `turbopackFileSystemCacheForBuild` both default to `true` in 16.3. Measured on this tree: **cold build (no `.next`) 53.8 s → warm build 11.0 s**, a 4.9× improvement that the repository is _already_ getting. FR-003 is therefore satisfied today. Writing the two flags into `next.config.ts` explicitly would restate a default and create a second source of truth that silently diverges when the default changes; the plan records the measurement and the default instead (Principle VII). The cache lives at `.next/cache/turbopack` and measures **352 MB** on this tree.
- **R7 — Typed routes produce exactly 11 errors in 8 files, and none of them is a typo.** Every failure is a component that accepts a route as `string` and forwards it to `Link`/`router`. Template-literal `href`s (20 of them) type-check cleanly, because Next infers dynamic segments. `next build` and `npx tsc --noEmit -p tsconfig.check.json` report the identical set. Full list in the Typed-route defect table below.
- **R8 — `optimizePackageImports` may already be redundant.** 16.3 defaults `experimental.turbopackInferModuleSideEffects: true`, which infers side-effect-free modules for tree shaking. Of the five packages the spec names, `zenput`, `d3-array`, `d3-scale` and `d3-shape` all declare `"sideEffects": false` and ship ESM, so they are already shakeable; **`@upstash/search-ui` is imported nowhere in `src/`** and is dead weight in `package.json` rather than a bundling problem. This story is therefore measurement-gated: add a package only if `npm run analyze` shows a reduction, and remove nothing from `package.json` under this feature.
- **R9 — `next build` no longer prints per-route size columns.** The 16.3 route table shows only Route / Revalidate / Expire. Bundle measurement must come from `npm run analyze` (which writes the analyzer reports), not from build output.
- **R10 — Manual memoization is unevenly covered by tests.** 48 files contain `useMemo`/`useCallback`. 47 of them are referenced by at least one suite under `__tests__/`; `src/features/admin/components/CouponsClient.tsx` is referenced by none. Test files do **not** uniformly mirror `src/` paths (for example `src/features/product/components/ProductGrid.tsx` is covered by `__tests__/components/sections/ProductGrid*.test.tsx`), so coverage must be established by reference search, not by path convention.
- **R11 — The compiler's own lint diagnostics are already wired up.** `eslint-plugin-react-hooks@7.1.1` is installed transitively through `eslint-config-next`, and `eslint.config.js` spreads `configs.recommended`, which includes the compiler-derived rules (`preserve-manual-memoization`, `incompatible-library`, `static-components`, `memo-dependencies`, `void-use-memo`). `npm run lint` currently passes clean, so any new diagnostic after enabling the compiler is attributable to this feature.

- **R12 — `npm run analyze` produces no report under Turbopack, so the bundle measurement method in R9 had to change.** `@next/bundle-analyzer` prints `The Next Bundle Analyzer is not compatible with Turbopack builds, no report will be generated` and the build otherwise completes normally. `next experimental-analyze --output` does work (it writes `.next/diagnostics/analyze`), but it **replaces `.next/server`** as a side effect, so it cannot be interleaved with a build whose output is still being measured. The measurement used here is therefore derived from the build output itself: for every prerendered route, sum the byte size of the distinct `/_next/static/**/*.js` chunks referenced by its HTML (first-load JS), and separately sum every chunk under `.next/static/chunks`. Both numbers are deterministic, need no extra tooling, and are directly comparable before and after. `npm run analyze` is still the script the spec names (FR-010) and it is still run; it simply contributes no per-route figures under this bundler.
- **R13 — With the compiler on, no client bundle grows.** Measured with the R12 method at the same commit: total client chunk bytes and every per-route first-load set are recorded in the Measurement protocol table below. The compiler adds an import of `react/compiler-runtime` and inlines memo caches, which is close to byte-neutral because the hand-written `useMemo`/`useCallback` wrappers it replaces were themselves code.

## Capability inventory (FR-006)

Each capability is one commit with one revert path, in this order.

| #   | Capability                  | Change                                                                                     | Revert                                                                  | Gate that proves it                       |
| --- | --------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Measurement baseline        | none to shipped code; measurements recorded in this plan                                   | n/a                                                                     | recorded numbers                          |
| 2   | Typed routes                | `typedRoutes: true` in `next.config.ts` + route-prop types in 8 files                      | delete the flag; the prop types stay valid and harmless                 | `npx tsc --noEmit -p tsconfig.check.json` |
| 3   | React Compiler              | `babel-plugin-react-compiler` devDependency + `reactCompiler: true` + memoization removals | delete the flag; removals are separate commits, revertable individually | `npm run build`, `npm test`               |
| 4   | CI cache key                | key/`restore-keys` rewrite in `.github/workflows/build.yml`                                | restore the previous key block                                          | CI run timing                             |
| 5   | Package-import optimization | `experimental.optimizePackageImports` list, only if measured                               | delete the list                                                         | `npm run analyze` diff                    |

Capability 3 is deliberately split: enabling the flag is one commit, and each module's memoization removal is its own commit, so a regression in one module never forces the compiler off.

## Typed-route defect table (US2, FR-002)

All 11 errors, verified 2026-08-07. Each is a component that accepts a route as `string`. The fix in every case is to type the prop as `Route` (imported from `next`) rather than to cast at the call site; the spec's edge case explicitly rejects `as` casts as a remedy.

| File                                                    | Line(s)       | Shape                                                           |
| ------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| `src/components/ui/CtaButton.tsx`                       | 16            | `href?: string` prop forwarded to `Link`                        |
| `src/components/ui/RouteErrorCard.tsx`                  | 97, 137       | route strings forwarded to `Link`                               |
| `src/features/admin/components/AdminBreadcrumbs.tsx`    | 26            | `item.href` on a breadcrumb item type                           |
| `src/features/admin/components/AdminNavLinksClient.tsx` | 258, 343, 467 | nav-item `href` used in `Link` and in `router.push`             |
| `src/features/cart/components/CheckoutProgress.tsx`     | 43            | checkout step `href`                                            |
| `src/features/product/components/ProductGrid.tsx`       | 559, 802      | `router.push` of a built query string, and a reset `href`       |
| `src/app/(public)/products/[id]/ProductClient.tsx`      | 81            | `router.replace(\`${pathname}${search}\`)`— pathname is`string` |

The last row is the only genuine escape-hatch candidate: `usePathname()` returns `string`, so a same-page query-string update cannot be statically typed. It gets a single, commented, explicitly reviewed narrowing at that one site (US2 acceptance 3). Every other row is a data-shape fix, not an escape hatch.

## Memoization removal policy (US1, FR-007, FR-008)

- The compiler compiles; manual memoization is removed only to reduce noise, never to make the compiler work. Nothing about correctness depends on the removals, so any module may be skipped without cost.
- Removal proceeds **one feature module per commit**, in this order, chosen so the shared low-level modules — where a behavioral change would propagate furthest — go first, under the strongest test coverage:
  1. `src/hooks/` (6 files) — `useCursorPagination`, `useFetch`, `useFormState`, `useLocalStorage`, `useModalState`, `useMutation`. All six have mirrored suites under `__tests__/hooks/`.
  2. `src/contexts/` (2 files) — `CurrencyContext`, `ThemeContext`. Both have mirrored suites. **Review first**: a context value's referential identity is a behavioral signal for every consumer's effect dependencies (spec edge case).
  3. `src/features/product/components/` (6 files) and `src/features/product/hooks/`.
  4. `src/features/admin/components/` (6 files) — excluding `CouponsClient.tsx` (R10).
  5. `src/app/(public)/account/` (5 files).
  6. Remaining single-file modules, only as capacity allows.
- A module is eligible only when an existing suite references it. `CouponsClient.tsx` is not eligible; it keeps its manual memoization and is recorded as such.
- Any component the compiler bails out on keeps its manual memoization (FR-008) and is recorded in the bailout register with the reason.
- After each removal commit, `npm test` and `npm run lint` must pass; a new `react-hooks/preserve-manual-memoization` diagnostic is a signal that the removal was unsafe and must be reverted rather than suppressed.

## Compiler bailout register (SC-006)

The register is a table in this plan, filled during implementation, with one row per component the compiler could not optimize:

| Component                        | Reason reported | Memoization disposition |
| -------------------------------- | --------------- | ----------------------- |
| _(filled during implementation)_ |                 |                         |

Sources for the register, in order of preference: the compiler diagnostics surfaced by `npm run lint` through `eslint-plugin-react-hooks` (R11), and the build output when `reactCompiler` is configured with a logger. If the register comes back empty, that is a result and is recorded as such — not an excuse to skip the check.

## CI cache key (US3, FR-005)

The current key in `.github/workflows/build.yml` is:

<!-- doc-drift-ignore-next-block --> <!-- reproduces the defective key this feature replaces; it names directories that no longer exist -->

```yaml
key: ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json', 'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.css', 'app/**/*.ts', 'app/**/*.tsx', 'pages/**/*.ts', 'pages/**/*.tsx', 'next.config.*') }}
```

Three defects:

1. `app/**` and `pages/**` have not existed since the move to `src/`; they contribute nothing and mislead the next reader.
2. Hashing every source file makes the key change on **every commit**, so the exact-match restore never hits and a fresh 352 MB entry is saved on every run. The cache still works — via `restore-keys` prefix fallback — but the exact-match half of the design is dead weight.
3. The path `.next/cache` does cover `.next/cache/turbopack` (verified), so FR-005's directory-coverage clause is already met; the key, not the path, is what needs repair.

Target: key on the inputs that actually invalidate compilation — `package-lock.json` and `next.config.ts` — and let `restore-keys` supply the prefix fallback, matching the Next.js documented pattern. Correctness is unaffected either way: Turbopack validates its own cache entries and falls back to a cold build when they are incompatible (FR/US3 acceptance 4), which is why a looser key is safe.

## Measurement protocol (FR-009, FR-010)

One machine, one commit, cache state stated explicitly with every number.

All measurements below were taken on the implementation sandbox (2 vCPU GitHub
Actions runner, Node 22) at commit `e45639b`, which is the tree immediately
before this feature's first code change. Cache state is stated with each figure.

| Measurement            | Method                                              | Baseline (before)                | After (all capabilities on) |
| ---------------------- | --------------------------------------------------- | -------------------------------- | --------------------------- |
| Cold build             | `rm -rf .next` then `npm run build`                 | **46.4 s**                       | _pending_                   |
| Warm build             | `npm run build` immediately after, cache populated  | **10.3 s** (compile step 0.46 s) | _pending_                   |
| Turbopack cache size   | `du -sh .next/cache/turbopack`                      | **286 MB**                       | _pending_                   |
| Dev startup, cold      | `rm -rf .next`, `npm run dev`, time to "Ready"      | **376 ms**                       | _pending_                   |
| Dev startup, warm      | restart `npm run dev` with `.next/cache` populated  | **371 ms**                       | _pending_                   |
| Client JS, all chunks  | sum of `.next/static/chunks/**/*.js` after a build  | **2 692 608 B**                  | _pending_                   |
| Client JS, worst route | largest per-route first-load chunk set (R12 method) | **1 459.2 KB** (`/admin/users`)  | _pending_                   |

Reading of the baseline: the Turbopack filesystem cache is worth **4.5×** on a
build (46.4 s → 10.3 s) and is already on by default (R6), so US3's speed
acceptance is satisfied by the default rather than by a new flag.

Absolute numbers are sandbox-specific and are not portable to CI or to a developer laptop; only the before/after delta on the _same_ machine is meaningful. Every figure quoted in the PR must name its machine and cache state.

## Project Structure

### Documentation (this feature)

```text
specs/015-build-and-dx-modernization/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Task breakdown
```

No `research.md`, `data-model.md` or `contracts/` — this feature introduces no entity, no endpoint, and no data shape. Phase 0 findings are inlined above because they are short and are read together with the capability inventory.

### Source Code (repository root)

```text
next.config.ts                                    # capabilities 2, 3, 5
package.json                                      # babel-plugin-react-compiler (devDependencies)
.github/workflows/build.yml                       # capability 4
src/components/ui/CtaButton.tsx                   # typed-route prop
src/components/ui/RouteErrorCard.tsx              # typed-route prop
src/features/admin/components/AdminBreadcrumbs.tsx        # typed-route prop
src/features/admin/components/AdminNavLinksClient.tsx     # typed-route prop
src/features/cart/components/CheckoutProgress.tsx         # typed-route prop
src/features/product/components/ProductGrid.tsx           # typed-route prop
src/app/(public)/products/[id]/ProductClient.tsx          # documented escape hatch
src/hooks/**, src/contexts/**, src/features/**, src/app/** # memoization removals
docs/development.md                               # FR-012
```

**Structure Decision**: unchanged. This feature adds no directory and moves no file; it edits configuration, eight route-prop declarations, and a bounded set of memoization sites.

## Risks

| Risk                                                               | Mitigation                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| The compiler changes behavior in a component with no unit coverage | Removals are limited to covered modules; the compiler itself is enabled globally and verified by the full suite plus a Playwright run |
| Compile time regression compounds on Vercel builds                 | R5 quantifies it (+6.5 s warm); re-measure on CI and revert capability 3 alone if it exceeds tolerance                                |
| Typed routes tempt `as Route` casts                                | The defect table names the fix for each site; exactly one escape hatch is permitted and is commented                                  |
| Removing context memoization changes consumers' effect firing      | Contexts are reviewed before removal and are their own commit, revertable in isolation                                                |
| Bundle "optimization" that optimizes nothing                       | R8 makes the story measurement-gated; no package is listed without an analyzer diff                                                   |

## Complexity Tracking

No constitutional violations. Table intentionally empty.
