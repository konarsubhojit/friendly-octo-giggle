# Feature Specification: Self-Hosted Provider Seam (PR A of 2)

**Feature Branch**: `026-self-hosted-provider-seam`
**Created**: 2026-09-13
**Status**: Implemented
**Epic**: Phase 2 — Portability
**Input**: Close every remaining gap between the app and a self-hosted VM
(Oracle Cloud Ampere A1, arm64) deployment without forking or changing Vercel
behaviour, by completing the existing pluggable-provider seam. Deployment
assets (Dockerfile, systemd, Caddy, CI workflow, Oracle runbook) are explicitly
out of scope and land in a follow-up PR (B).

## Baseline (verified 2026-09-13)

`src/lib/providers/resolution.ts` and `src/lib/providers/types.ts` already
defined seven pluggable capabilities (`database`, `cache`, `search`,
`storage`, `rateLimit`, `config`, `jobs`), each resolved through one
documented precedence rule — explicit selector variable, then provider
inferred from credential presence, then a documented default — and each with
a self-hostable backend already implemented (`postgres`, `redis`, `postgres`,
`s3`, `redis`, `environment`, `inline`). Four things still bypassed that seam:

- `waitUntil` from `@vercel/functions` was imported directly, with no
  abstraction, in `src/lib/redis.ts`, `src/lib/email/retry.ts`, and
  `src/features/ai/services/chat-stream.ts` (five call sites total).
- `src/app/layout.tsx` hard-mounted `<Analytics>` / `<SpeedInsights>` from
  `@vercel/analytics/next` / `@vercel/speed-insights/next`, plus a
  `va.vercel-scripts.com` preconnect, unconditionally.
- `isFallbackProviderConfigured` in `src/lib/storage/index.ts` read
  `process.env.BLOB_READ_WRITE_TOKEN` directly instead of going through the
  same `env` object every other provider check uses.
- `next.config.ts` had no notion of a deploy target: `output: 'standalone'`
  was never emitted, there was no cache handler wired up for Cache
  Components/ISR, and `automaticVercelMonitors` was hardcoded `true`.

## What shipped

- **Eighth capability: `deferred`.** `DEFERRED_PROVIDERS = ['vercel',
'process']`, selector `DEFERRED_PROVIDER`, inferred `vercel` when `VERCEL`
  is set, default `process`. `src/lib/deferred/` provides a `DeferredRunner`
  contract (`types.ts`), a `vercel.ts` adapter that lazily `require()`s
  `@vercel/functions` so the package is never loaded off-platform, a
  `process.ts` adapter that runs the promise inline on the current, long-lived
  Node process and routes any rejection through `logError` with a
  `deferred_work_failed` context (so nothing becomes an unhandled rejection),
  and an `index.ts` singleton factory (`getDeferredRunner()`, a `waitUntil`
  convenience export, `__resetDeferredRunnerForTests()`). All five original
  call sites now import `waitUntil` from `@/lib/deferred`; the redundant
  try/catch fallback in `sendWithRetry` (`src/lib/email/retry.ts`) was
  simplified since the provider itself now guarantees the fallback behaviour.
- **Ninth capability: `analytics`.** `ANALYTICS_PROVIDERS = ['vercel',
'none']`, selector `ANALYTICS_PROVIDER`, inferred `vercel` when `VERCEL` is
  set, default `none`. `src/components/analytics/PlatformAnalytics.tsx` is an
  async server component that checks the resolved provider, dynamically
  imports `@vercel/analytics/next` and `@vercel/speed-insights/next` only when
  it is `vercel`, and renders nothing otherwise. `src/app/layout.tsx` renders
  `<PlatformAnalytics />` instead of mounting the vendor components directly,
  and the `va.vercel-scripts.com` preconnect/dns-prefetch is gated on the same
  condition.
- **`DEPLOY_TARGET` preset tier.** `DEPLOY_TARGET` (`vercel` | `self-hosted`,
  inferred from `process.env.VERCEL`, default `vercel`) is a new tier in
  `resolveCapability`, inserted between credential inference and the
  hardcoded fallback: explicit selector → credential inference → `DEPLOY_
TARGET` preset → hardcoded fallback. The `vercel` preset reproduces every
  existing fallback exactly (no behaviour change); the `self-hosted` preset
  sets `storage: 's3'`, `config: 'environment'`, `deferred: 'process'`,
  `analytics: 'none'`, `jobs: 'inline'`, and leaves `database`/`cache`/
  `search`/`rateLimit` to credential inference since those are external HTTP
  services that behave identically regardless of where the compute runs. A
  new `'preset'` value was added to `ProviderSelectionSource` so
  `summarizeProviders()` can report when a selection came from this tier, and
  the summary now surfaces the resolved `DEPLOY_TARGET` itself.
- **Storage env-read fix.** `isFallbackProviderConfigured` in
  `src/lib/storage/index.ts` now reads `env.BLOB_READ_WRITE_TOKEN`, matching
  every other check in the module.
- **`next.config.ts` provider-aware config.** Calls `resolveProviders
(process.env)` once at module scope (the one place in the app allowed to
  read `process.env` directly, since it runs before the app's env-validation
  layer is guaranteed usable) and derives `isSelfHosted` /
  `hasCacheBackend` from the result. `output: 'standalone'` is emitted only
  when self-hosted (Vercel ignores the field, so it is simply omitted there
  rather than set redundantly). `cacheHandlers.default` and
  `cacheMaxMemorySize: 0` are wired to `src/lib/cache-handler.ts` only when
  self-hosted _and_ a cache backend is actually configured — otherwise Next's
  own in-memory handler is exactly right for a single Vercel-managed
  invocation. `automaticVercelMonitors` is now `!isSelfHosted` rather than a
  hardcoded `true`. The Sentry `sourcemaps.disable` branch keyed on
  `VERCEL === '1' && VERCEL_ENV === 'preview'` is unchanged in behaviour — it
  is still needed for Vercel preview builds — but now carries a comment
  noting it is Vercel-only and inert elsewhere.
- **`src/lib/cache-handler.ts` — Redis-backed Cache Components handler.**
  Implements the Next.js 16 `CacheHandler` contract (`get`/`set`/
  `refreshTags`/`getExpiration`/`updateTags`) entirely on top of the existing
  `CacheClient` contract from `src/lib/cache/index.ts` — no new Redis client
  or vendor SDK. Entries are stored as a single JSON document (base64-encoded
  value bytes plus tags/timestamp/expire/revalidate metadata) under
  `nextcache:v1:entry:<key>`; each tag's most recent stale/expired timestamps
  are stored under `nextcache:v1:tag:<tag>` with a 30-day retention window so
  `updateTags` from one instance invalidates entries read by any other
  instance, rather than only the process that received the write. `get`
  treats an entry as missing once its own expiry window has elapsed or any of
  its tags were revalidated after it was written; a tag marked merely stale
  (not expired) causes the entry to be served with `revalidate: -1` to force a
  background refresh. An `expire: 0` (fully dynamic) entry is never persisted.
  When `getCacheClient()` returns `null` (no cache backend actually reachable
  despite being configured), every operation degrades to an always-miss /
  no-op — Next.js simply regenerates on every request rather than crashing.
- **Env schema.** `src/lib/validations/env.ts` accepts `DEPLOY_TARGET`,
  `DEFERRED_PROVIDER`, `ANALYTICS_PROVIDER` (all optional enums, validated
  against the same `*_PROVIDERS`/`DEPLOY_TARGETS` arrays used by the
  resolution module) and `BLOB_READ_WRITE_TOKEN` (optional string, matching
  the fix above). No previously-optional variable was made required and no
  existing variable was removed.

## Requirements

- **FR-001**: `deferred` and `analytics` MUST be added to
  `PROVIDER_CAPABILITIES` and follow the exact conventions of the existing
  seven capabilities (selector, values array, required-keys table, resolver).
- **FR-002**: No source file outside `src/lib/deferred/` MAY import
  `@vercel/functions`, and no source file outside
  `src/components/analytics/PlatformAnalytics.tsx` MAY import
  `@vercel/analytics/next` or `@vercel/speed-insights/next`.
- **FR-003**: The `process` deferred adapter MUST NOT allow a promise
  rejection to become an unhandled rejection; it MUST be logged via
  `logError` with a `deferred_work_failed` context instead.
- **FR-004**: `DEPLOY_TARGET` MUST occupy exactly one precedence tier —
  between credential inference and the hardcoded fallback — and MUST NOT be
  able to override an explicit selector or a credential-inferred provider for
  any capability.
- **FR-005**: The `vercel` `DEPLOY_TARGET` preset MUST resolve to the exact
  same values as today's hardcoded fallbacks for every capability, so that
  `summarizeProviders(process.env)` on a Vercel-shaped environment (with no
  new variables set) is unchanged from before this feature.
- **FR-006**: `isFallbackProviderConfigured` in `src/lib/storage/index.ts`
  MUST read credential presence through the shared `env` object, not
  `process.env` directly.
- **FR-007**: `src/lib/cache-handler.ts` MUST implement `get`/`set`/
  `refreshTags`/`getExpiration`/`updateTags` on top of the existing
  `CacheClient` contract, MUST namespace its Redis keys separately from the
  application's own cache keys, and MUST degrade to a safe no-op/always-miss
  behaviour when `getCacheClient()` returns `null`.
- **FR-008**: `next.config.ts` MUST NOT set `output: 'standalone'` or wire up
  `cacheHandlers` when `DEPLOY_TARGET` resolves to `vercel`.
- **FR-009**: The environment schema MUST accept `DEPLOY_TARGET`,
  `DEFERRED_PROVIDER`, and `ANALYTICS_PROVIDER` without making any
  currently-optional variable required.

## Success Criteria

- **SC-001**: `npm run lint:strict`, `npm run format:check`, `npm run test`,
  `npm run build`, `npx tsc --noEmit -p tsconfig.check.json`, and
  `npm run docs:check` all pass.
- **SC-002**: With no new environment variables set, `summarizeProviders
(process.env)` on a Vercel-shaped environment (`VERCEL` set) returns
  identical provider selections, for all nine capabilities, to what the seven
  pre-existing capabilities resolved to before this feature.
- **SC-003**: Setting `DEPLOY_TARGET=self-hosted` with no other selectors set
  resolves `storage` to `s3`, `config` to `environment`, `deferred` to
  `process`, `analytics` to `none`, and `jobs` to `inline`, with zero
  `issues` reported.
- **SC-004**: An explicit selector (for example `STORAGE_PROVIDER=vercel`)
  still wins over the `DEPLOY_TARGET=self-hosted` preset; credential
  inference (for example `EDGE_CONFIG` present) still wins over the preset.
- **SC-005**: The `process` deferred adapter never produces an unhandled
  promise rejection — a rejected promise passed to `waitUntil` is caught and
  logged instead.
- **SC-006**: The cache handler round-trips a stored value byte-for-byte and
  a tag revalidation via `updateTags` causes a subsequent `get` for any entry
  carrying that tag to report a miss.
