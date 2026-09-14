/**
 * Application-owned provider contracts.
 *
 * Every infrastructure capability the application depends on — database,
 * cache, search, storage, rate limiting, configuration, background jobs,
 * post-response deferred work, and analytics — names its backends here, in
 * application vocabulary, independently of any vendor SDK. Call sites depend
 * on these identifiers and on the single resolution path in `./resolution.ts`;
 * they never read environment variables or inspect provider hostnames to work
 * out which backend they are talking to.
 */

export const PROVIDER_CAPABILITIES = [
  'database',
  'cache',
  'search',
  'storage',
  'rateLimit',
  'config',
  'jobs',
  'deferred',
  'analytics',
] as const

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number]

export const DATABASE_DRIVERS = ['postgres', 'neon'] as const
export const CACHE_PROVIDERS = ['redis', 'upstash', 'none'] as const
export const SEARCH_PROVIDERS = ['postgres', 'algolia', 'upstash'] as const
export const STORAGE_PROVIDERS = ['s3', 'vercel', 'r2'] as const
export const RATE_LIMIT_PROVIDERS = ['redis', 'upstash', 'memory'] as const
export const CONFIG_PROVIDERS = ['environment', 'edge-config'] as const
export const JOBS_PROVIDERS = ['inngest', 'inline'] as const
/** Where post-response background work (`waitUntil`) runs. */
export const DEFERRED_PROVIDERS = ['vercel', 'process'] as const
/** Which platform analytics/speed-insights beacons are mounted. */
export const ANALYTICS_PROVIDERS = ['vercel', 'none'] as const

export type DatabaseDriver = (typeof DATABASE_DRIVERS)[number]
export type CacheProvider = (typeof CACHE_PROVIDERS)[number]
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number]
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number]
export type RateLimitProvider = (typeof RATE_LIMIT_PROVIDERS)[number]
export type ConfigProvider = (typeof CONFIG_PROVIDERS)[number]
export type JobsProvider = (typeof JOBS_PROVIDERS)[number]
export type DeferredProvider = (typeof DEFERRED_PROVIDERS)[number]
export type AnalyticsProvider = (typeof ANALYTICS_PROVIDERS)[number]

/** The provider identifier space for a given capability. */
export interface ProviderByCapability {
  readonly database: DatabaseDriver
  readonly cache: CacheProvider
  readonly search: SearchProvider
  readonly storage: StorageProvider
  readonly rateLimit: RateLimitProvider
  readonly config: ConfigProvider
  readonly jobs: JobsProvider
  readonly deferred: DeferredProvider
  readonly analytics: AnalyticsProvider
}

/**
 * The deployment preset switch.
 *
 * `DEPLOY_TARGET` never overrides an explicit selector or credential
 * inference — it only supplies a preset of per-capability defaults that sits
 * between them and the hardcoded fallback. See the precedence table in
 * `./resolution.ts`.
 */
export const DEPLOY_TARGETS = ['vercel', 'self-hosted'] as const
export type DeployTarget = (typeof DEPLOY_TARGETS)[number]

export type ProviderName = ProviderByCapability[ProviderCapability]

/**
 * How a provider was chosen.
 *
 * - `explicit` — the capability's own selector variable named it.
 * - `inferred` — no selector was set, so the provider was derived from which
 *   credentials are present. This is what keeps existing deployments on the
 *   backend they already use.
 * - `preset`   — no selector or credential decided it, but `DEPLOY_TARGET`
 *   supplies a preset default for this capability.
 * - `default`  — nothing was configured; the documented default applies.
 */
export type ProviderSelectionSource =
  | 'explicit'
  | 'inferred'
  | 'preset'
  | 'default'

export interface ProviderSelection<C extends ProviderCapability> {
  readonly capability: C
  readonly provider: ProviderByCapability[C]
  readonly source: ProviderSelectionSource
  /** The variable that decided the selection, when one did. */
  readonly selector?: string
}

export type ProviderSelections = {
  readonly [C in ProviderCapability]: ProviderSelection<C>
}

/** A single actionable configuration problem, scoped to one variable. */
export interface ProviderConfigIssue {
  readonly capability: ProviderCapability
  readonly provider: ProviderName
  /** The environment variable that must change to fix the issue. */
  readonly field: string
  readonly message: string
}

/**
 * One sanitized row of the provider summary. Deliberately carries no URLs,
 * tokens, or credentials — only the decision and whether it is satisfiable.
 */
export interface ProviderSummaryEntry {
  readonly capability: ProviderCapability
  readonly provider: ProviderName
  readonly source: ProviderSelectionSource
  readonly configured: boolean
}

export interface ProviderSummary {
  readonly providers: readonly ProviderSummaryEntry[]
  /** The resolved deployment preset switch (see `DEPLOY_TARGETS`). */
  readonly deployTarget: DeployTarget
  /** Legacy variables in use, named so they can be migrated. Never valued. */
  readonly deprecatedAliases: readonly string[]
  readonly issues: readonly ProviderConfigIssue[]
}
