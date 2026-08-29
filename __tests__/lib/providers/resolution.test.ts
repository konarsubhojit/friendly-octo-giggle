import { describe, expect, it } from 'vitest'
import {
  DEPRECATED_ENV_ALIASES,
  PROVIDER_REQUIRED_KEYS,
  PROVIDER_SELECTOR_KEYS,
  resolveProviders,
  summarizeProviders,
  type ProviderEnvSource,
} from '@/lib/providers/resolution'
import {
  PROVIDER_CAPABILITIES,
  type ProviderCapability,
} from '@/lib/providers/types'

const SECRETS = {
  REDIS_URL: 'redis://localhost:6379',
  UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-redis-token-secret',
  UPSTASH_SEARCH_REST_URL: 'https://search.upstash.io',
  UPSTASH_SEARCH_REST_TOKEN: 'upstash-search-token-secret',
  ALGOLIA_APP_ID: 'algolia-app',
  ALGOLIA_API_KEY: 'algolia-key-secret',
  ALGOLIA_INDEX_NAME: 'products',
  S3_REGION: 'eu-central-1',
  S3_BUCKET: 'images',
  S3_ACCESS_KEY_ID: 's3-access-key',
  S3_SECRET_ACCESS_KEY: 's3-secret-key',
  S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
  R2_ACCOUNT_ID: 'r2-account',
  R2_ACCESS_KEY_ID: 'r2-access-key',
  R2_SECRET_ACCESS_KEY: 'r2-secret-key',
  R2_BUCKET: 'images',
  R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
  EDGE_CONFIG: 'https://edge-config.vercel.com/ecfg_1?token=edge-secret',
  INNGEST_EVENT_KEY: 'inngest-event-secret',
  INNGEST_SIGNING_KEY: 'inngest-signing-secret',
} as const

const baseEnv: ProviderEnvSource = {
  DATABASE_URL: 'postgresql://localhost:5432/shop',
}

const withSelection = (
  capability: ProviderCapability,
  provider: string,
  extra: ProviderEnvSource = {}
): ProviderEnvSource => ({
  ...baseEnv,
  [PROVIDER_SELECTOR_KEYS[capability]]: provider,
  ...extra,
})

const credentialsFor = (
  capability: ProviderCapability,
  provider: string
): ProviderEnvSource =>
  Object.fromEntries(
    (
      (PROVIDER_REQUIRED_KEYS[capability] as Record<string, readonly string[]>)[
        provider
      ] ?? []
    ).map((key) => [key, SECRETS[key as keyof typeof SECRETS] ?? 'value'])
  )

const allSelections = PROVIDER_CAPABILITIES.flatMap((capability) =>
  Object.keys(PROVIDER_REQUIRED_KEYS[capability]).map(
    (provider) => [capability, provider] as const
  )
)

describe('resolveProviders — explicit selection', () => {
  it.each(allSelections)(
    'accepts %s=%s with its credentials present',
    (capability, provider) => {
      const source = withSelection(
        capability,
        provider,
        credentialsFor(capability, provider)
      )

      const { selections, issues } = resolveProviders(source)

      expect(selections[capability].provider).toBe(provider)
      expect(selections[capability].source).toBe('explicit')
      expect(selections[capability].selector).toBe(
        PROVIDER_SELECTOR_KEYS[capability]
      )
      expect(issues).toEqual([])
    }
  )

  it.each(
    allSelections.flatMap(([capability, provider]) =>
      (
        (
          PROVIDER_REQUIRED_KEYS[capability] as Record<
            string,
            readonly string[]
          >
        )[provider] ?? []
      )
        .filter((key) => key !== 'DATABASE_URL')
        .map((key) => [capability, provider, key] as const)
    )
  )(
    'reports %s=%s missing %s as a field-scoped issue',
    (capability, provider, key) => {
      const credentials = credentialsFor(capability, provider)
      delete (credentials as Record<string, string | undefined>)[key]

      const { issues } = resolveProviders(
        withSelection(capability, provider, credentials)
      )

      expect(issues).toEqual([
        {
          capability,
          provider,
          field: key,
          message: `${key} must be set when ${PROVIDER_SELECTOR_KEYS[capability]}='${provider}'`,
        },
      ])
    }
  )

  it('treats a whitespace-only credential as missing', () => {
    const { issues } = resolveProviders(
      withSelection('cache', 'redis', { REDIS_URL: '   ' })
    )

    expect(issues.map((issue) => issue.field)).toEqual(['REDIS_URL'])
  })

  it('normalizes selector case and surrounding whitespace', () => {
    const { selections } = resolveProviders(
      withSelection('search', '  ALGOLIA ', credentialsFor('search', 'algolia'))
    )

    expect(selections.search.provider).toBe('algolia')
  })

  it('reports an unknown selector value with the legal values', () => {
    const { selections, issues } = resolveProviders(
      withSelection('cache', 'memcached')
    )

    expect(issues).toEqual([
      {
        capability: 'cache',
        provider: 'none',
        field: 'CACHE_PROVIDER',
        message: 'CACHE_PROVIDER must be one of: redis, upstash, none',
      },
    ])
    expect(selections.cache.provider).toBe('none')
  })
})

describe('resolveProviders — ambiguous configurations', () => {
  it('rejects SEARCH_PROVIDER=algolia without complete Algolia credentials', () => {
    const { issues } = resolveProviders(
      withSelection('search', 'algolia', {
        ALGOLIA_APP_ID: SECRETS.ALGOLIA_APP_ID,
      })
    )

    expect(issues.map((issue) => issue.field)).toEqual([
      'ALGOLIA_API_KEY',
      'ALGOLIA_INDEX_NAME',
    ])
  })

  it('rejects CACHE_PROVIDER=redis without REDIS_URL', () => {
    const { issues } = resolveProviders(withSelection('cache', 'redis'))

    expect(issues).toHaveLength(1)
    expect(issues[0].field).toBe('REDIS_URL')
  })

  it('rejects an explicit selection even when another provider is fully configured', () => {
    const { issues, selections } = resolveProviders(
      withSelection('cache', 'redis', {
        UPSTASH_REDIS_REST_URL: SECRETS.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: SECRETS.UPSTASH_REDIS_REST_TOKEN,
      })
    )

    expect(selections.cache.provider).toBe('redis')
    expect(issues.map((issue) => issue.field)).toEqual(['REDIS_URL'])
  })
})

describe('resolveProviders — backward compatibility', () => {
  it('keeps a bare deployment on the documented defaults', () => {
    const { selections, issues } = resolveProviders(baseEnv)

    expect(issues).toEqual([])
    expect(
      Object.fromEntries(
        Object.values(selections).map((selection) => [
          selection.capability,
          selection.provider,
        ])
      )
    ).toEqual({
      database: 'postgres',
      cache: 'none',
      search: 'postgres',
      storage: 'vercel',
      rateLimit: 'memory',
      config: 'environment',
      jobs: 'inline',
    })
  })

  it('infers the existing managed stack from credentials alone', () => {
    const { selections, issues } = resolveProviders({
      ...baseEnv,
      UPSTASH_REDIS_REST_URL: SECRETS.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: SECRETS.UPSTASH_REDIS_REST_TOKEN,
      UPSTASH_SEARCH_REST_URL: SECRETS.UPSTASH_SEARCH_REST_URL,
      UPSTASH_SEARCH_REST_TOKEN: SECRETS.UPSTASH_SEARCH_REST_TOKEN,
      EDGE_CONFIG: SECRETS.EDGE_CONFIG,
      INNGEST_EVENT_KEY: SECRETS.INNGEST_EVENT_KEY,
      INNGEST_SIGNING_KEY: SECRETS.INNGEST_SIGNING_KEY,
    })

    expect(issues).toEqual([])
    expect(selections.cache.provider).toBe('upstash')
    expect(selections.rateLimit.provider).toBe('upstash')
    expect(selections.search.provider).toBe('upstash')
    expect(selections.config.provider).toBe('edge-config')
    expect(selections.jobs.provider).toBe('inngest')
    expect(selections.cache.source).toBe('inferred')
  })

  it('infers a self-hosted Redis deployment from REDIS_URL alone', () => {
    const { selections } = resolveProviders({
      ...baseEnv,
      REDIS_URL: SECRETS.REDIS_URL,
    })

    expect(selections.cache.provider).toBe('redis')
    expect(selections.rateLimit.provider).toBe('redis')
  })

  it('does not require credentials for an inferred or defaulted provider', () => {
    const { issues } = resolveProviders({
      ...baseEnv,
      INNGEST_EVENT_KEY: SECRETS.INNGEST_EVENT_KEY,
    })

    expect(issues).toEqual([])
  })

  it('reports deprecated lowercase database aliases by name only', () => {
    const { deprecatedAliases } = resolveProviders({
      ...baseEnv,
      database_url: 'postgresql://localhost:5432/shop',
    })

    expect(deprecatedAliases).toEqual(['database_url'])
    expect(Object.keys(DEPRECATED_ENV_ALIASES)).toContain('database_url')
  })

  it('reports no deprecated aliases for a canonical environment', () => {
    expect(resolveProviders(baseEnv).deprecatedAliases).toEqual([])
  })
})

describe('summarizeProviders', () => {
  const fullEnv: ProviderEnvSource = {
    ...baseEnv,
    ...SECRETS,
    CACHE_PROVIDER: 'upstash',
    SEARCH_PROVIDER: 'algolia',
    STORAGE_PROVIDER: 'r2',
    JOBS_PROVIDER: 'inngest',
  }

  it('covers every capability exactly once', () => {
    const summary = summarizeProviders(fullEnv)

    expect(summary.providers.map((entry) => entry.capability)).toEqual([
      ...PROVIDER_CAPABILITIES,
    ])
  })

  it('marks a provider without its credentials as not configured', () => {
    const summary = summarizeProviders({
      ...baseEnv,
      CACHE_PROVIDER: 'redis',
    })

    const cache = summary.providers.find(
      (entry) => entry.capability === 'cache'
    )
    expect(cache).toMatchObject({ provider: 'redis', configured: false })
  })

  it('never leaks a secret or credential-bearing URL', () => {
    const serialized = JSON.stringify(summarizeProviders(fullEnv))

    Object.values(SECRETS).forEach((secret) => {
      expect(serialized).not.toContain(secret)
    })
  })
})
