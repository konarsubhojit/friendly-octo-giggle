/**
 * Application-owned provider contracts.
 *
 * Every infrastructure capability the application depends on — database,
 * cache, search, storage, rate limiting, configuration, and background jobs —
 * names its backends here, in application vocabulary, independently of any
 * vendor SDK. Call sites depend on these identifiers and on the single
 * resolution path in `./resolution.ts`; they never read environment variables
 * or inspect provider hostnames to work out which backend they are talking to.
 */

export const PROVIDER_CAPABILITIES = [
  'database',
  'cache',
  'search',
  'storage',
  'rateLimit',
  'config',
  'jobs',
] as const

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number]

export const DATABASE_DRIVERS = ['postgres', 'neon'] as const
export const CACHE_PROVIDERS = ['redis', 'upstash', 'none'] as const
export const SEARCH_PROVIDERS = ['postgres', 'algolia', 'upstash'] as const
export const STORAGE_PROVIDERS = ['s3', 'vercel', 'r2'] as const
export const RATE_LIMIT_PROVIDERS = ['redis', 'upstash', 'memory'] as const
export const CONFIG_PROVIDERS = ['environment', 'edge-config'] as const
export const JOBS_PROVIDERS = ['inngest', 'inline'] as const

export type DatabaseDriver = (typeof DATABASE_DRIVERS)[number]
export type CacheProvider = (typeof CACHE_PROVIDERS)[number]
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number]
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number]
export type RateLimitProvider = (typeof RATE_LIMIT_PROVIDERS)[number]
export type ConfigProvider = (typeof CONFIG_PROVIDERS)[number]
export type JobsProvider = (typeof JOBS_PROVIDERS)[number]

/** The provider identifier space for a given capability. */
export interface ProviderByCapability {
  readonly database: DatabaseDriver
  readonly cache: CacheProvider
  readonly search: SearchProvider
  readonly storage: StorageProvider
  readonly rateLimit: RateLimitProvider
  readonly config: ConfigProvider
  readonly jobs: JobsProvider
}

export type ProviderName = ProviderByCapability[ProviderCapability]

/**
 * How a provider was chosen.
 *
 * - `explicit` — the capability's own selector variable named it.
 * - `inferred` — no selector was set, so the provider was derived from which
 *   credentials are present. This is what keeps existing deployments on the
 *   backend they already use.
 * - `default`  — nothing was configured; the documented default applies.
 */
export type ProviderSelectionSource = 'explicit' | 'inferred' | 'default'

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
  /** Legacy variables in use, named so they can be migrated. Never valued. */
  readonly deprecatedAliases: readonly string[]
  readonly issues: readonly ProviderConfigIssue[]
}
