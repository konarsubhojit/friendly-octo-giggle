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

### What fixing the 11 exposed (implementation, 2026-08-07)

Typing the props surfaced two further errors that the flag alone could not
reach, because they only appear once the prop is narrower than `string`. Both
are recorded here rather than in the table above, since neither was visible in
the Phase 0 probe:

| File                                        | Finding                                                                                | Disposition                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(public)/cart/error.tsx`           | `secondaryHref="/products"` — **there is no `/products` route**, only `/products/[id]` | **Real defect fixed.** The "Continue shopping" link in the cart error boundary was a 404. Corrected to `/shop`, and `error-pages.test.tsx` updated. |
| `src/app/admin/products/[id]/edit/page.tsx` | breadcrumb `href: \`/admin/products/${id}\``rejected against a non-generic`Route`      | `BreadcrumbItem` and `AdminPageShell` are now generic in the route literal (`Route<T>`), so dynamic hrefs check against the real route tree.        |

The first is precisely the class of defect US2 exists to catch, found on the
first run of the feature it justifies, in a user-facing error path.

`EmptyState.ctaHref` was typed as `Route` alongside `CtaButton.href`, since it
forwards straight into it; leaving it `string` would have moved the error one
component outward instead of fixing it.

## Memoization removal policy (US1, FR-007, FR-008)

- The compiler compiles; manual memoization is removed only to reduce noise, never to make the compiler work. Nothing about correctness depends on the removals, so any module may be skipped without cost.
- Removal proceeds **one feature module per commit**, in this order, chosen so the shared low-level modules — where a behavioral change would propagate furthest — go first, under the strongest test coverage:
  1. `src/hooks/` (6 files) — `useCursorPagination`, `useFetch`, `useFormState`, `useLocalStorage`, `useModalState`, `useMutation`. All six have mirrored suites under `__tests__/hooks/`.
  2. `src/contexts/` (2 files) — `CurrencyContext`, `ThemeContext`. Both have mirrored suites. **Review first**: a context value's referential identity is a behavioral signal for every consumer's effect dependencies (spec edge case).
  3. `src/features/product/components/` (6 files) and `src/features/product/hooks/`.
  4. `src/features/admin/components/` (6 files) — excluding `CouponsClient.tsx` (R10).
  5. `src/app/(public)/account/` (5 files).
  6. Remaining single-file modules, only as capacity allows.
- A module is eligible only when an existing suite references it. `CouponsClient.tsx` was the one memoized module with no referencing suite; `__tests__/features/admin/components/CouponsClient.test.tsx` was written for it (T031), which made it eligible, and its `setField` memoization was removed under the same rule as every other module. **The skip recorded by T029 therefore no longer applies** — no module in the removal scope remains excluded for lack of coverage.
- Any component the compiler bails out on keeps its manual memoization (FR-008) and is recorded in the bailout register with the reason. The register is empty, so no component is retained on those grounds (see below).
- After each removal commit, `npm test` and `npm run lint` must pass; a new `react-hooks/preserve-manual-memoization` diagnostic is a signal that the removal was unsafe and must be reverted rather than suppressed.

## Compiler bailout register (SC-006)

The register is a table in this plan, with one row per component the compiler
could not optimize.

**The register is empty. That is the measured result, not an unperformed check.**

| Component | Reason reported | Memoization disposition |
| --------- | --------------- | ----------------------- |
| _(none)_  | —               | —                       |

Evidence, collected 2026-08-07 with `reactCompiler: true` in place:

- `npx react-compiler-healthcheck --src "src/**/*.{ts,tsx}" --verbose` reports
  **"Successfully compiled 252 out of 252 components"**, no incompatible-library
  usage, and no `StrictMode` obstruction.
- `npm run lint` is clean, so none of the compiler-derived
  `eslint-plugin-react-hooks` rules — `preserve-manual-memoization`,
  `incompatible-library`, `static-components`, `memo-dependencies`,
  `void-use-memo`, `unsupported-syntax` — fires on any file (R11).
- `npm run build` completes with no compiler diagnostic in its output.

Because the register is empty, FR-008 ("do not remove manual memoization from a
component the compiler could not optimize") constrains nothing here: every
component compiles, so eligibility for removal is decided solely by test
coverage (FR-007). No component retains manual memoization _because of a
bailout_ (T030) — the memoization that survives the removal commits survives for
a different, stated reason.

### Memoization deliberately retained (not bailouts)

Recorded 2026-08-07 after the T024–T029 removal commits. Each entry is a value
whose **referential identity is a contract with a `useEffect` dependency array**,
not a render-time optimization; removing it would change how often an effect
re-runs, which is behavior rather than performance.

| Module                                                  | Retained value                                         | Why                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/features/admin/components/AdminNavLinksClient.tsx` | `updateMenuPosition`                                   | Listed in the scroll/resize listener effect's deps; a new identity re-binds both listeners |
| `src/features/admin/components/VariantFormModal.tsx`    | `primaryImagePreviewUrl`, `additionalImagePreviewUrls` | Each creates an object URL — a side effect — that the paired effect revokes on cleanup     |
| `src/app/(public)/account/AccountClient.tsx`            | `fetchProfile`                                         | Listed in the profile-load effect's deps; a new identity re-fetches on every render        |
| `src/app/(public)/account/NotificationsSection.tsx`     | `loadSettings`                                         | Listed in the settings-load effect's deps, same failure mode                               |

### The unit suite now exercises compiled output

Vitest builds through `@vitejs/plugin-react` and never reads `next.config.ts`,
so by default `npm test` would run the **uncompiled** sources: a green suite
would prove the hand-written logic still works, but would say nothing about the
code the production build actually ships. A compiler-introduced regression could
pass 3 557 green tests unnoticed.

`vitest.config.mts` therefore passes `babel-plugin-react-compiler` to the React
plugin, so the suite compiles components exactly as the build does. All 301
files / 3 557 tests pass with the compiler in the pipeline, and the suite
duration is unchanged (≈100 s). This closes the gap between what the tests cover
and what users receive, and makes US1 acceptance 2 a real check rather than a
formality.

## What the React Compiler costs (US1, measured 2026-08-07)

Same machine, same commit, `reactCompiler` toggled and a **cold** build each
time so no stale chunk from a previous build can be counted.

| Metric                                         | Compiler off | Compiler on | Delta               |
| ---------------------------------------------- | ------------ | ----------- | ------------------- |
| Cold build, wall clock                         | 46.4 s       | 58.1 s      | +11.7 s             |
| Cold build, compile step                       | 22.0 s       | 28.9 s      | +6.9 s              |
| Warm build (cache populated)                   | 10.3 s       | 12.6 s      | +2.3 s              |
| Client JS, all chunks, raw                     | 2 692 584 B  | 2 846 296 B | +153 712 B (+5.7 %) |
| Client JS, all chunks, gzip                    | 790 221 B    | 861 323 B   | +71 102 B (+9.0 %)  |
| Worst route first-load, gzip (`/admin/orders`) | 404.3 KB     | 410.8 KB    | +6.5 KB (+1.6 %)    |
| Best route delta, gzip (`/_global-error`)      | —            | —           | +0.2 KB (+0.3 %)    |

**This contradicts SC-004 as literally written** ("No route bundle is larger
than its recorded baseline"), and the contradiction is reported rather than
smoothed over. Every route grows between 0.3 % and 1.8 % gzipped, because the
compiler emits a per-component memo cache array and an import of
`react/compiler-runtime`. SC-004 was written under US4, where it means "import
optimization must not make bundles worse"; it holds in that scope. Under US1 it
does not, and cannot: automatic memoization is bytes-for-renders by
construction.

The trade is deliberate and is recorded so a future reader can re-decide it:
~1.6 % more gzipped JS on the worst route, in exchange for removing an entire
class of stale-dependency-array defect across 133 client files. If that trade is
ever judged wrong, capability 3 reverts by deleting one line of
`next.config.ts`; nothing else in the feature depends on it.

Build-time cost lands in CI and on Vercel, never on a user, and the Turbopack
cache absorbs most of it on incremental builds (+2.3 s warm).

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

Open item (T038): the CI build-job duration **after** the key change cannot be
recorded from this sandbox and cannot be read off the first run either — no
entry has ever been saved under the new key, so run 1 necessarily misses and
falls back through `restore-keys`. Read the exact-match hit and the job duration
off the second and later build runs on this PR's branch and record them here.

Target: key on the inputs that actually invalidate compilation — `package-lock.json` and `next.config.ts` — and let `restore-keys` supply the prefix fallback, matching the Next.js documented pattern. Correctness is unaffected either way: Turbopack validates its own cache entries and falls back to a cold build when they are incompatible (FR/US3 acceptance 4), which is why a looser key is safe.

## Measurement protocol (FR-009, FR-010)

One machine, one commit, cache state stated explicitly with every number.

All measurements below were taken on the implementation sandbox (2 vCPU GitHub
Actions runner, Node 22) at commit `e45639b`, which is the tree immediately
before this feature's first code change. Cache state is stated with each figure.

| Measurement            | Method                                              | Baseline (before)                | After (all capabilities on)      |
| ---------------------- | --------------------------------------------------- | -------------------------------- | -------------------------------- |
| Cold build             | `rm -rf .next` then `npm run build`                 | **46.4 s**                       | **61.1 s** (compile step 32.4 s) |
| Warm build             | `npm run build` immediately after, cache populated  | **10.3 s** (compile step 0.46 s) | **11.3 s** (compile step 0.49 s) |
| Turbopack cache size   | `du -sh .next/cache/turbopack`                      | **286 MB**                       | **289 MB**                       |
| Dev startup, cold      | `rm -rf .next`, `npm run dev`, time to "Ready"      | **376 ms**                       | **2.8 s** — see note below       |
| Dev startup, warm      | restart `npm run dev` with `.next/cache` populated  | **371 ms**                       | **394 ms**                       |
| Client JS, all chunks  | sum of `.next/static/chunks/**/*.js` after a build  | **2 692 608 B**                  | **2 844 997 B** (+5.7 %)         |
| Client JS, worst route | largest per-route first-load chunk set (R12 method) | **1 459.2 KB** (`/admin/users`)  | **1 470.1 KB** (`/admin/users`)  |

All "after" figures were taken on the same sandbox class as the baseline, at the
tree with typed routes, the React Compiler, and every memoization-removal commit
in place, and with `optimizePackageImports` **absent** (T043 removed it; see
below).

The cold dev-startup pair is **not comparable**: the baseline 376 ms was Next's
self-reported "Ready in" line with `.next/cache` still on disk, whereas the
"after" 2.8 s was measured after `rm -rf .next`, which forces the dev server to
rebuild its cache before reporting ready. The warm pair (371 ms → 394 ms) is
measured identically on both sides and is the figure to read. Re-measuring the
cold baseline would mean reverting the feature, which is not worth the signal;
the discrepancy is recorded rather than papered over.

Reading of the "after" column (US3 acceptances 1 and 2, SC-003): the Turbopack
filesystem cache is worth **5.4×** on a build with every capability on
(61.1 s → 11.3 s), against 4.5× at baseline — the compiler's added work is
exactly the kind of work the cache absorbs, so the cache is worth more after
this feature than before it. Wall-clock cost of the feature is +14.7 s cold and
+1.0 s warm, all of it in CI or on Vercel and none of it on a user.

### Graceful degradation of a damaged cache (T037, US3 acceptance 4)

Two failure modes were exercised on the same tree:

1. **Deleted cache** (`rm -rf .next/cache/turbopack`): the next `npm run build`
   falls back to a cold build (44.6 s) and produces **byte-identical** output —
   2 844 997 B of client chunks, the same figure as the cached build. Correctness
   is unaffected; only time is lost. This is the case CI hits whenever the cache
   key misses.
2. **Corrupted cache** (4 KB of random bytes written over one `.sst` file): the
   build **aborts** with a `turbo-persistence` panic in Turbopack rather than
   discarding the entry and recompiling. This is a Turbopack defect, not a
   configuration one, and the recovery is `rm -rf .next/cache/turbopack`
   followed by a normal build, which succeeds. The failure is loud and immediate
   (4.6 s, non-zero exit) rather than silent, so it cannot produce a wrong
   artifact — the spec's "correctness outranks speed" edge case holds, but the
   caveat is recorded here and in `docs/development.md` so nobody debugs it
   twice. GitHub's cache service checksums its archives, so a partially written
   entry is not a realistic CI failure mode.

### Package-import optimization: measured null result (T042–T045)

`experimental.optimizePackageImports: ['zenput', 'd3-array', 'd3-scale', 'd3-shape']`
was added, built with `ANALYZE=true npm run build`, and compared against the
same tree without it:

| Metric                          | Without the option | With the option | Delta |
| ------------------------------- | ------------------ | --------------- | ----- |
| Client JS, all chunks           | 2 844 997 B        | 2 844 997 B     | **0** |
| Worst route first-load          | 1 470.1 KB         | 1 470.1 KB      | **0** |
| Next 4 worst routes, first-load | identical          | identical       | **0** |

**Byte-for-byte identical.** The option was therefore removed from
`next.config.ts` per T043 and Principle VII: it earned nothing and would have
been an inert line implying an optimization that does not exist. The cause is
R8 — all four packages already ship ESM and declare `"sideEffects": false`
(verified in their installed `package.json` files: `zenput` 1.1.2, `d3-array`
3.2.4, `d3-scale` 4.0.2, `d3-shape` 3.2.0), and
`experimental.turbopackInferModuleSideEffects` is already `true` by default in
16.3, so Turbopack was already importing them at module granularity.

`@upstash/search-ui` 0.1.5 is imported from **no file under `src/`**: it is an
unused dependency, not a bundling problem, and it contributes nothing to any
bundle. It is deliberately **not** removed here (out of scope per the spec) and
is noted for a dependency-cleanup pass.

No route bundle grew as a result of US4, because US4 shipped no change (SC-004).

Reading of the baseline: the Turbopack filesystem cache is worth **4.5×** on a
build (46.4 s → 10.3 s) and is already on by default (R6), so US3's speed
acceptance is satisfied by the default rather than by a new flag. Verified at
implementation time (T032) by reading the installed
`next/dist/server/config-shared.js` default config at 16.3.0, where
`turbopackFileSystemCacheForDev` and `turbopackFileSystemCacheForBuild` are both
`true`. Neither flag is declared in `next.config.ts`: restating a default would
create a second source of truth that silently diverges the day the default
changes. If a future Next.js release flips either default, this decision is
revisited then, and this paragraph is the record of why the flags are absent.

The cached path in `.github/workflows/build.yml` is `.next/cache`, which
contains `.next/cache/turbopack` (verified: 289 MB under
`.next/cache/turbopack/v16.3.0-<hash>/`). FR-005's directory-coverage clause is
already met and no path change is needed (T036).

Absolute numbers are sandbox-specific and are not portable to CI or to a developer laptop; only the before/after delta on the _same_ machine is meaningful. Every figure quoted in the PR must name its machine and cache state.

## Final verification (Phase 7, 2026-08-07)

### Five gates with every capability enabled (T050, FR-011, SC-001)

Run on the implementation sandbox (2 vCPU GitHub Actions runner, Node 22) with
`typedRoutes: true` and `reactCompiler: true` both on and the working tree at
the final state of this branch.

| Gate                                      | Result                               |
| ----------------------------------------- | ------------------------------------ |
| `npm run lint`                            | pass, zero warnings                  |
| `npx tsc --noEmit -p tsconfig.check.json` | pass, zero errors                    |
| `npm test`                                | pass — 302 files, 3 562 tests        |
| `npm run build`                           | pass — 56.5 s cold (`.next` removed) |
| `npm run docs:check`                      | pass — 126 Markdown files scanned    |

### Revert isolation (T051, SC-007)

The four landed capabilities were verified to be independently revertable. The
branch's git history is squashed, so isolation was proven the way it actually
matters — by applying each revert to the working tree and re-running that
capability's gate from the Capability inventory — rather than by checking out a
commit per capability.

| Capability                      | Revert applied                                                  | Result with the other capabilities still on                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 — Typed routes                | delete `typedRoutes: true` from `next.config.ts`                | `tsc` clean, `npm run build` succeeds; `Route`-typed props remain valid because `Route` is exported by `next` regardless of the flag                                                  |
| 3 — React Compiler              | delete `reactCompiler: true` from `next.config.ts`              | `tsc` clean, `npm run build` succeeds; the unit suite is unaffected because `vitest.config.mts` configures the Babel plugin itself, independently of `next.config.ts`                 |
| 4 — CI cache key                | restore the previous key block in `.github/workflows/build.yml` | no coupling to any other capability — the key is consumed only by `actions/cache`, and Turbopack validates its own entries, so a stale or missed key costs time and never correctness |
| 5 — Package-import optimization | nothing landed (measured null result, T042–T045)                | nothing to revert                                                                                                                                                                     |

`next.config.ts` was restored to its committed state after each probe;
`git diff` is empty on the file.

### Deferred tasks

- **T022** — running the Playwright suite against a production build with the
  compiler on. Blocked on the drifted, unowned Playwright suite recorded in
  `specs/README.md`: `playwright-tests/latest-features.spec.ts` still asserts
  Spanish locale routing and `playwright.config.ts` probes a `/en/shop` URL that
  the route tree no longer contains, both removed with localization in PR #407.
  Repairing that suite is outside this feature's scope and would make its
  "no product behavior change" claim false. SC-005 therefore rests on the unit
  suite (3 562 tests) until the suite has an owner.
- **T038** — the CI build-job duration after the cache-key change. Deferred by
  construction, as recorded under [CI cache key](#ci-cache-key-us3-fr-005): no
  entry has ever been saved under the new key, so the first run on this branch
  necessarily misses and falls through `restore-keys`. Read the exact-match hit
  and the job duration off the second and later build runs on this PR.

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
