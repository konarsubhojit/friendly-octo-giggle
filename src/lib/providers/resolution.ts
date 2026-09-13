/**
 * The single provider-resolution path.
 *
 * Every capability is resolved here, from a plain environment record, by one
 * deterministic four-tier precedence rule:
 *
 *   1. the capability's explicit selector variable, when set;
 *   2. otherwise the provider *inferred from which credentials are present*,
 *      so a deployment that predates the selectors keeps the backend it
 *      already uses;
 *   3. otherwise the preset default supplied by `DEPLOY_TARGET`, when that
 *      preset names a provider for this capability;
 *   4. otherwise the documented hardcoded fallback.
 *
 * | Capability | Selector              | Inference order (credentials present)      | Default       |
 * | ---------- | --------------------- | ------------------------------------------ | ------------- |
 * | database   | `DATABASE_DRIVER`     | —                                          | `postgres`    |
 * | cache      | `CACHE_PROVIDER`      | upstash → redis                            | `none`        |
 * | search     | `SEARCH_PROVIDER`     | upstash → algolia                          | `postgres`    |
 * | storage    | `STORAGE_PROVIDER`    | —                                          | `vercel`      |
 * | rateLimit  | `RATE_LIMIT_PROVIDER` | upstash → redis                            | `memory`      |
 * | config     | `CONFIG_PROVIDER`     | edge-config                                | `environment` |
 * | jobs       | `JOBS_PROVIDER`       | inngest                                    | `inline`      |
 * | deferred   | `DEFERRED_PROVIDER`   | vercel (from `VERCEL`)                     | `process`     |
 * | analytics  | `ANALYTICS_PROVIDER`  | vercel (from `VERCEL`)                     | `none`        |
 *
 * Inference reads credential *presence* only. No provider is ever derived
 * from a hostname, and no call site outside this module decides which backend
 * a capability uses.
 *
 * `DEPLOY_TARGET` (`vercel` | `self-hosted`, default `vercel`, inferred from
 * `process.env.VERCEL` when unset) sits between tiers 2 and 4 above. It is a
 * *preset of defaults*, never an override: an explicit selector or an
 * inferred credential always wins over it. Its presets are:
 *
 * | `DEPLOY_TARGET` | Preset overrides                                                          |
 * | --------------- | -------------------------------------------------------------------------- |
 * | `vercel`        | none — exactly today's hardcoded fallbacks                               |
 * | `self-hosted`   | `storage: s3`, `config: environment`, `deferred: process`, `analytics: none`, `jobs: inline` |
 *
 * `database`, `cache`, `search`, and `rateLimit` have no `self-hosted` preset
 * because their backends are external HTTP services (Postgres, Redis,
 * Upstash) that work identically on Vercel and off it — inference already
 * covers them.
 */

import {
  ANALYTICS_PROVIDERS,
  CACHE_PROVIDERS,
  CONFIG_PROVIDERS,
  DATABASE_DRIVERS,
  DEFERRED_PROVIDERS,
  DEPLOY_TARGETS,
  JOBS_PROVIDERS,
  RATE_LIMIT_PROVIDERS,
  SEARCH_PROVIDERS,
  STORAGE_PROVIDERS,
  type AnalyticsProvider,
  type CacheProvider,
  type ConfigProvider,
  type DatabaseDriver,
  type DeferredProvider,
  type DeployTarget,
  type JobsProvider,
  type ProviderCapability,
  type ProviderConfigIssue,
  type ProviderByCapability,
  type ProviderName,
  type ProviderSelection,
  type ProviderSelections,
  type ProviderSummary,
  type RateLimitProvider,
  type SearchProvider,
  type StorageProvider,
} from './types.ts'

export type ProviderEnvSource = Readonly<Record<string, string | undefined>>

export interface ProviderResolution {
  readonly selections: ProviderSelections
  readonly deployTarget: DeployTarget
  readonly issues: readonly ProviderConfigIssue[]
  readonly deprecatedAliases: readonly string[]
}

/** The `DEPLOY_TARGET` selector variable, shared by resolution and docs. */
export const DEPLOY_TARGET_KEY = 'DEPLOY_TARGET'

/** Selector variable per capability, shared by resolution, errors, and docs. */
export const PROVIDER_SELECTOR_KEYS = {
  database: 'DATABASE_DRIVER',
  cache: 'CACHE_PROVIDER',
  search: 'SEARCH_PROVIDER',
  storage: 'STORAGE_PROVIDER',
  rateLimit: 'RATE_LIMIT_PROVIDER',
  config: 'CONFIG_PROVIDER',
  jobs: 'JOBS_PROVIDER',
  deferred: 'DEFERRED_PROVIDER',
  analytics: 'ANALYTICS_PROVIDER',
} as const satisfies Record<ProviderCapability, string>

/** Legal values per capability, for actionable "did you mean" error text. */
export const PROVIDER_VALUES = {
  database: DATABASE_DRIVERS,
  cache: CACHE_PROVIDERS,
  search: SEARCH_PROVIDERS,
  storage: STORAGE_PROVIDERS,
  rateLimit: RATE_LIMIT_PROVIDERS,
  config: CONFIG_PROVIDERS,
  jobs: JOBS_PROVIDERS,
  deferred: DEFERRED_PROVIDERS,
  analytics: ANALYTICS_PROVIDERS,
} as const

/**
 * Variables each provider cannot work without.
 *
 * `vercel` storage and `neon`/`postgres` database carry no extra requirement
 * beyond what the base environment schema already enforces, so selecting them
 * can never turn a previously-booting deployment into a failing one.
 */
export const PROVIDER_REQUIRED_KEYS = {
  database: {
    postgres: ['DATABASE_URL'],
    neon: ['DATABASE_URL'],
  },
  cache: {
    redis: ['REDIS_URL'],
    upstash: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    none: [],
  },
  search: {
    postgres: [],
    algolia: [
      'ALGOLIA_APP_ID',
      'ALGOLIA_ADMIN_API_KEY',
      'ALGOLIA_PRODUCTS_INDEX',
    ],
    upstash: ['UPSTASH_SEARCH_REST_URL', 'UPSTASH_SEARCH_REST_TOKEN'],
  },
  storage: {
    s3: [
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_PUBLIC_BASE_URL',
    ],
    vercel: [],
    r2: [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
      'R2_PUBLIC_BASE_URL',
    ],
  },
  rateLimit: {
    redis: ['REDIS_URL'],
    upstash: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    memory: [],
  },
  config: {
    environment: [],
    'edge-config': ['EDGE_CONFIG'],
  },
  jobs: {
    inngest: ['INNGEST_EVENT_KEY', 'INNGEST_SIGNING_KEY'],
    inline: [],
  },
  deferred: {
    vercel: [],
    process: [],
  },
  analytics: {
    vercel: [],
    none: [],
  },
} as const satisfies {
  [C in ProviderCapability]: Record<string, readonly string[]>
}

/**
 * The `DEPLOY_TARGET` preset layer: per-capability defaults applied only when
 * neither an explicit selector nor credential inference decided a capability.
 *
 * `vercel` is deliberately empty — it must reproduce today's hardcoded
 * fallbacks exactly, so it contributes nothing here and resolution falls
 * through to tier 4.
 */
export const DEPLOY_TARGET_PRESETS: {
  readonly [T in DeployTarget]: Partial<ProviderByCapability>
} = {
  vercel: {},
  'self-hosted': {
    storage: 's3',
    config: 'environment',
    deferred: 'process',
    analytics: 'none',
    jobs: 'inline',
  },
}

/**
 * Legacy variable names that are still honoured, mapped to their replacement.
 * Reported by name only — a deprecation notice never carries a value.
 */
export const DEPRECATED_ENV_ALIASES = {
  database_url: 'DATABASE_URL',
  read_database_url: 'READ_DATABASE_URL',
  R2_ACCESS_KEY_ID: 'S3_ACCESS_KEY_ID',
  R2_SECRET_ACCESS_KEY: 'S3_SECRET_ACCESS_KEY',
  R2_BUCKET: 'S3_BUCKET',
  R2_PUBLIC_BASE_URL: 'S3_PUBLIC_BASE_URL',
  R2_ACCOUNT_ID: 'S3_ENDPOINT (derived from R2_ACCOUNT_ID)',
} as const

const isSet = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0

const LEGACY_PROVIDER_KEYS: Readonly<Record<string, string>> = {
  ALGOLIA_ADMIN_API_KEY: 'ALGOLIA_API_KEY',
  ALGOLIA_PRODUCTS_INDEX: 'ALGOLIA_INDEX_NAME',
}

const allSet = (source: ProviderEnvSource, keys: readonly string[]): boolean =>
  keys.every(
    (key) =>
      isSet(source[key]) || isSet(source[LEGACY_PROVIDER_KEYS[key] ?? ''])
  )

const readSelector = (
  source: ProviderEnvSource,
  key: string
): string | undefined => {
  const raw = source[key]
  return isSet(raw) ? raw!.trim().toLowerCase() : undefined
}

interface CapabilityResolver<C extends ProviderCapability> {
  readonly infer: (
    source: ProviderEnvSource
  ) => ProviderByCapability[C] | undefined
  readonly fallback: ProviderByCapability[C]
}

const hasUpstashRedis = (source: ProviderEnvSource): boolean =>
  allSet(source, PROVIDER_REQUIRED_KEYS.cache.upstash)

const hasRedisUrl = (source: ProviderEnvSource): boolean =>
  isSet(source.REDIS_URL)

const RESOLVERS: { [C in ProviderCapability]: CapabilityResolver<C> } = {
  database: {
    infer: () => undefined,
    fallback: 'postgres' satisfies DatabaseDriver,
  },
  cache: {
    infer: (source) => {
      if (hasUpstashRedis(source)) return 'upstash'
      if (hasRedisUrl(source)) return 'redis'
      return undefined
    },
    fallback: 'none' satisfies CacheProvider,
  },
  search: {
    infer: (source) => {
      if (allSet(source, PROVIDER_REQUIRED_KEYS.search.upstash))
        return 'upstash'
      if (allSet(source, PROVIDER_REQUIRED_KEYS.search.algolia))
        return 'algolia'
      return undefined
    },
    fallback: 'postgres' satisfies SearchProvider,
  },
  storage: {
    infer: () => undefined,
    fallback: 'vercel' satisfies StorageProvider,
  },
  rateLimit: {
    infer: (source) => {
      if (hasUpstashRedis(source)) return 'upstash'
      if (hasRedisUrl(source)) return 'redis'
      return undefined
    },
    fallback: 'memory' satisfies RateLimitProvider,
  },
  config: {
    infer: (source) => (isSet(source.EDGE_CONFIG) ? 'edge-config' : undefined),
    fallback: 'environment' satisfies ConfigProvider,
  },
  jobs: {
    infer: (source) =>
      isSet(source.INNGEST_EVENT_KEY) ? 'inngest' : undefined,
    fallback: 'inline' satisfies JobsProvider,
  },
  deferred: {
    // `VERCEL` is set automatically on every Vercel deployment, so this
    // reproduces today's unconditional `@vercel/functions` usage exactly.
    infer: (source) => (isSet(source.VERCEL) ? 'vercel' : undefined),
    fallback: 'process' satisfies DeferredProvider,
  },
  analytics: {
    infer: (source) => (isSet(source.VERCEL) ? 'vercel' : undefined),
    fallback: 'none' satisfies AnalyticsProvider,
  },
}

/**
 * Resolve `DEPLOY_TARGET`.
 *
 * Not a capability — it never appears in `ProviderSelections` — but a preset
 * switch consulted by `resolveCapability`. `process.env.VERCEL` only ever
 * infers `vercel`, the same value the hardcoded default already is, so an
 * unconfigured deployment can never silently become `self-hosted`: that value
 * is reachable only by setting `DEPLOY_TARGET` explicitly. An unrecognized
 * value is caught by the environment schema's own enum check; here it simply
 * falls through to the same default an unset variable would produce.
 */
const resolveDeployTarget = (source: ProviderEnvSource): DeployTarget => {
  const requested = readSelector(source, DEPLOY_TARGET_KEY)
  if (
    requested !== undefined &&
    (DEPLOY_TARGETS as readonly string[]).includes(requested)
  ) {
    return requested as DeployTarget
  }
  return 'vercel'
}

const requiredKeysFor = (
  capability: ProviderCapability,
  provider: ProviderName
): readonly string[] => {
  const byProvider: Record<string, readonly string[]> =
    PROVIDER_REQUIRED_KEYS[capability]
  return byProvider[provider] ?? []
}

const resolveCapability = <C extends ProviderCapability>(
  capability: C,
  source: ProviderEnvSource,
  deployTarget: DeployTarget,
  issues: ProviderConfigIssue[]
): ProviderSelection<C> => {
  const selector = PROVIDER_SELECTOR_KEYS[capability]
  const requested = readSelector(source, selector)
  const legalValues: readonly string[] = PROVIDER_VALUES[capability]
  const resolver = RESOLVERS[capability]

  if (requested !== undefined && legalValues.includes(requested)) {
    const provider = requested as ProviderByCapability[C]
    requiredKeysFor(capability, provider).forEach((key) => {
      if (isSet(source[key]) || isSet(source[LEGACY_PROVIDER_KEYS[key] ?? '']))
        return
      issues.push({
        capability,
        provider,
        field: key,
        message: `${key} must be set when ${selector}='${provider}'`,
      })
    })
    return { capability, provider, source: 'explicit', selector }
  }

  if (requested !== undefined) {
    issues.push({
      capability,
      provider: resolver.fallback,
      field: selector,
      message: `${selector} must be one of: ${legalValues.join(', ')}`,
    })
  }

  const inferred = resolver.infer(source)
  if (inferred !== undefined) {
    return { capability, provider: inferred, source: 'inferred' }
  }

  const preset = DEPLOY_TARGET_PRESETS[deployTarget][capability]
  if (preset !== undefined) {
    return {
      capability,
      provider: preset as ProviderByCapability[C],
      source: 'preset',
    }
  }

  return { capability, provider: resolver.fallback, source: 'default' }
}

const listDeprecatedAliases = (source: ProviderEnvSource): string[] =>
  Object.keys(DEPRECATED_ENV_ALIASES).filter((alias) => isSet(source[alias]))

const normalizeAliases = (source: ProviderEnvSource): ProviderEnvSource => {
  const r2AccountId = source.R2_ACCOUNT_ID?.trim()
  return {
    ...source,
    DATABASE_URL: source.DATABASE_URL ?? source.database_url,
    READ_DATABASE_URL: source.READ_DATABASE_URL ?? source.read_database_url,
    S3_REGION: source.S3_REGION ?? (r2AccountId ? 'auto' : undefined),
    S3_BUCKET: source.S3_BUCKET ?? source.R2_BUCKET,
    S3_ACCESS_KEY_ID: source.S3_ACCESS_KEY_ID ?? source.R2_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY:
      source.S3_SECRET_ACCESS_KEY ?? source.R2_SECRET_ACCESS_KEY,
    S3_PUBLIC_BASE_URL: source.S3_PUBLIC_BASE_URL ?? source.R2_PUBLIC_BASE_URL,
    S3_ENDPOINT:
      source.S3_ENDPOINT ??
      (r2AccountId
        ? `https://${r2AccountId}.r2.cloudflarestorage.com`
        : undefined),
    S3_FORCE_PATH_STYLE:
      source.S3_FORCE_PATH_STYLE ?? (r2AccountId ? 'true' : undefined),
  }
}

/**
 * Resolve every capability from `source`.
 *
 * Missing-credential issues are raised for *explicit* selections only: an
 * inferred or defaulted provider is, by construction, the one the deployment
 * is already able to reach, so it must never turn a booting deployment into a
 * failing one.
 */
export const resolveProviders = (
  source: ProviderEnvSource
): ProviderResolution => {
  const normalizedSource = normalizeAliases(source)
  const issues: ProviderConfigIssue[] = []
  const deployTarget = resolveDeployTarget(normalizedSource)
  const selections = {
    database: resolveCapability(
      'database',
      normalizedSource,
      deployTarget,
      issues
    ),
    cache: resolveCapability('cache', normalizedSource, deployTarget, issues),
    search: resolveCapability('search', normalizedSource, deployTarget, issues),
    storage: resolveCapability(
      'storage',
      normalizedSource,
      deployTarget,
      issues
    ),
    rateLimit: resolveCapability(
      'rateLimit',
      normalizedSource,
      deployTarget,
      issues
    ),
    config: resolveCapability('config', normalizedSource, deployTarget, issues),
    jobs: resolveCapability('jobs', normalizedSource, deployTarget, issues),
    deferred: resolveCapability(
      'deferred',
      normalizedSource,
      deployTarget,
      issues
    ),
    analytics: resolveCapability(
      'analytics',
      normalizedSource,
      deployTarget,
      issues
    ),
  } satisfies ProviderSelections

  return {
    selections,
    deployTarget,
    issues,
    deprecatedAliases: listDeprecatedAliases(source),
  }
}

/**
 * A summary safe to print at startup or serve from a health endpoint.
 *
 * It carries provider names, how each was chosen, and whether its credentials
 * are complete — never a URL, token, or any other credential-bearing value.
 */
export const summarizeProviders = (
  source: ProviderEnvSource
): ProviderSummary => {
  const { selections, deployTarget, issues, deprecatedAliases } =
    resolveProviders(source)

  return {
    providers: Object.values(selections).map((selection) => ({
      capability: selection.capability,
      provider: selection.provider,
      source: selection.source,
      configured: allSet(
        source,
        requiredKeysFor(selection.capability, selection.provider)
      ),
    })),
    deployTarget,
    deprecatedAliases,
    issues,
  }
}

let cached: ProviderResolution | null = null

/** Providers for the running process, resolved once from `process.env`. */
export const getProviderResolution = (): ProviderResolution => {
  cached ??= resolveProviders(process.env)
  return cached
}

export const getProvider = <C extends ProviderCapability>(
  capability: C
): ProviderByCapability[C] =>
  getProviderResolution().selections[capability].provider

export const getProviderSummary = (): ProviderSummary =>
  summarizeProviders(process.env)

/** Exposed for tests that need to re-resolve after changing `process.env`. */
export const __resetProviderResolutionForTests = (): void => {
  cached = null
}
