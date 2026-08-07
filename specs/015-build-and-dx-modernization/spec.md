# Feature Specification: Build and Developer Experience Modernization

**Feature Branch**: `015-build-and-dx-modernization`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 1 — Foundation: rendering model and stack modernization  
**Input**: Enable the build-level capabilities the installed toolchain already ships — React Compiler, typed routes, the Turbopack filesystem cache, and package-import optimization — so the application gets automatic memoization, link-level type safety, and materially faster builds.

## Baseline (verified 2026-08-01)

- The project runs Next.js `16.2.11`, React `19.2.7`, and TypeScript `6.0.3`. The installed `next` type definitions expose `reactCompiler`, `typedRoutes`, `turbopackFileSystemCacheForDev`, `turbopackFileSystemCacheForBuild`, and `optimizePackageImports`.
- `next.config.ts` declares **no** `experimental` block and none of these options. It currently configures only `serverExternalPackages`, `images`, and security `headers`, wrapped by the bundle analyzer and Sentry.
- The client surface is large: **133** files carry `'use client'`, and manual `useMemo` / `useCallback` memoization is applied by hand throughout.
- Heavy client-side dependencies that benefit from import optimization are already installed: `d3-array`, `d3-scale`, `d3-shape`, `@upstash/search-ui`, and `zenput`.
- CI restores and saves a `.next/cache` entry keyed on `package-lock.json` plus source globs. That key still references legacy `app/**` and `pages/**` paths that no longer exist, and it does not cover Turbopack's filesystem cache directories.
- Route strings are untyped, so a typo in an internal `href` or `redirect` target is only discoverable at runtime.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Automatic memoization replaces hand-written memo wrappers (Priority: P1)

Client components are memoized by the compiler, so re-render performance no longer depends on developers correctly hand-placing `useMemo` and `useCallback`.

**Why this priority**: Manual memoization across 133 client files is both a correctness risk (a missing or wrong dependency array causes stale UI or wasted renders) and a maintenance tax. The compiler removes the class of defect entirely.

**Independent Test**: Enable the compiler, build the application, and confirm the build succeeds, the unit suite passes, and interactive surfaces behave identically.

**Acceptance Scenarios**:

1. **Given** the React Compiler is enabled, **When** the application builds, **Then** the build succeeds and the compiler reports which components it could not compile.
2. **Given** the compiler is enabled, **When** the unit and end-to-end suites run, **Then** all previously passing tests still pass.
3. **Given** a component the compiler cannot optimize, **When** it is reported, **Then** the reason is recorded and the component either keeps its manual memoization or is refactored.
4. **Given** manual memoization is removed from a component, **When** it is removed, **Then** the removal is verified against that component's tests rather than assumed safe.

---

### User Story 2 - Invalid internal links fail at compile time (Priority: P1)

A developer who mistypes an internal route in a `Link`, `redirect`, or router call gets a type error instead of a production 404.

**Why this priority**: The application has a large route surface across public, account, checkout, order, and admin sections. Route typos are silent until a user hits them, and the storefront's most damaging version of this defect sits inside the checkout funnel.

**Independent Test**: Introduce a deliberate typo in an internal route reference and confirm `npx tsc --noEmit` reports an error.

**Acceptance Scenarios**:

1. **Given** typed routes are enabled, **When** a nonexistent internal route is referenced, **Then** type checking fails.
2. **Given** typed routes are enabled, **When** the existing codebase is type-checked, **Then** it reports zero errors after any required route-reference corrections.
3. **Given** a dynamically constructed route, **When** it cannot be statically typed, **Then** it uses a documented, explicitly reviewed escape hatch rather than disabling the feature.

---

### User Story 3 - Builds and dev startup are measurably faster (Priority: P2)

Local development restarts and CI builds reuse cached compilation work instead of repeating it.

**Why this priority**: Directly improves iteration speed and shortens the CI feedback loop that Phase 1 is making stricter, but it changes no product behavior.

**Independent Test**: Measure cold and warm build times before and after enabling the filesystem cache, on the same machine and commit.

**Acceptance Scenarios**:

1. **Given** the Turbopack filesystem cache is enabled for development, **When** the dev server is restarted, **Then** warm startup is faster than the recorded baseline.
2. **Given** the filesystem cache is enabled for builds, **When** a second build runs on unchanged sources, **Then** it is faster than the recorded cold baseline.
3. **Given** CI restores a build cache, **When** the cache key is computed, **Then** it covers the Turbopack cache directories and excludes paths that no longer exist.
4. **Given** a corrupt or incompatible cache entry, **When** a build runs, **Then** it falls back to a cold build rather than failing.

---

### User Story 4 - Client bundles carry only what they use (Priority: P3)

Heavy client dependencies are imported at module granularity so unused code does not reach the browser.

**Why this priority**: A real but bounded payload improvement, dependent on measurement to confirm it matters for the specific packages in use.

**Independent Test**: Record bundle sizes with `npm run analyze` before and after, and compare the affected route bundles.

**Acceptance Scenarios**:

1. **Given** import optimization is configured for the heavy client packages, **When** the bundle is analyzed, **Then** no affected route bundle grows.
2. **Given** a package is added to the optimization list, **When** the suites run, **Then** behavior is unchanged.
3. **Given** bundle analysis, **When** it is run before and after, **Then** both measurements are recorded in the feature plan.

---

### Edge Cases

- The React Compiler must not be enabled together with a build that silently skips compilation; if a required build plugin is unavailable, the build must fail loudly rather than produce unoptimized output that appears successful.
- Components relying on referential identity as a behavioral signal (for example, effect dependencies compared by identity) must be reviewed before their manual memoization is removed.
- Typed routes must not force `as` casts across the codebase; widespread casting indicates the routes need correction instead.
- A stale filesystem cache must never produce a build that differs from a cold build; correctness outranks speed.
- Enabling multiple build flags at once obscures attribution, so each must be independently revertable.
- Package-import optimization must not be applied to packages with import side effects.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `next.config.ts` MUST enable the React Compiler, and the build MUST fail rather than silently skip compilation if its prerequisites are unmet.
- **FR-002**: `next.config.ts` MUST enable typed routes, and `npx tsc --noEmit -p tsconfig.check.json` MUST report zero errors with it enabled.
- **FR-003**: The Turbopack filesystem cache MUST be enabled for development and for builds.
- **FR-004**: `optimizePackageImports` MUST list the heavy client packages in use, and no listed package may have import side effects.
- **FR-005**: The CI build cache key MUST cover the Turbopack cache directories and MUST NOT reference the nonexistent `app/**` and `pages/**` paths.
- **FR-006**: Each capability MUST be introduced as an independently revertable change so a regression can be attributed and rolled back in isolation.
- **FR-007**: Removal of manual `useMemo` / `useCallback` MUST proceed one feature module at a time, and each removal MUST be covered by that module's existing tests.
- **FR-008**: Manual memoization MUST NOT be removed from a component the compiler could not optimize.
- **FR-009**: Cold and warm build times and dev startup times MUST be recorded before and after, on the same machine and commit.
- **FR-010**: Bundle sizes MUST be recorded before and after using the existing `npm run analyze` script.
- **FR-011**: All four mandatory gates — `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, `npm run build` — MUST pass with every flag enabled.
- **FR-012**: `docs/development.md` MUST document the enabled build capabilities, the memoization policy under the compiler, and how to clear a corrupt cache.

### Key Entities

- **Build Capability**: A single configuration option enabled by this work, with its own measurement, verification, and revert path.
- **Compiler Bailout**: A component the React Compiler could not optimize, recorded with its reason and its memoization disposition.
- **Performance Baseline**: The recorded pre-change cold build, warm build, dev startup, and bundle-size measurements.
- **Cache Key**: The CI cache identity that determines when compilation work can be reused.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All four mandatory gates pass with the React Compiler, typed routes, the filesystem cache, and import optimization enabled.
- **SC-002**: A deliberately mistyped internal route causes a type-check failure.
- **SC-003**: Warm build time and dev startup time both improve against the recorded baseline.
- **SC-004**: No route bundle is larger than its recorded baseline.
- **SC-005**: The full Playwright suite passes with all capabilities enabled.
- **SC-006**: Every compiler bailout is recorded with a reason and a memoization disposition.
- **SC-007**: Each capability can be reverted independently without reverting the others.

## Out of Scope

- Rewriting components to change their rendering strategy; only memoization scaffolding is removed.
- Replacing the bundler, test runner, or TypeScript configuration.
- The rendering-model change, which belongs to `012-cache-components-and-ppr`.

## Dependencies

- Independent of `012-cache-components-and-ppr`, but both change build output, so they should land in separate pull requests with separate measurements.
- Browser-level verification that automatic memoization did not alter behavior is desirable but unowned; the specification that would have enabled the Playwright suite in CI (`013-e2e-in-continuous-integration`) was withdrawn on 2026-08-07.
