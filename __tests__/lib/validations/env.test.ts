import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnvSchema } from '@/lib/validations/env'

describe('EnvSchema', () => {
  const baseEnv = {
    DATABASE_URL: 'postgresql://localhost:5432/test',
  }

  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('validates minimal env with just DATABASE_URL', () => {
    const result = EnvSchema.safeParse(baseEnv)
    expect(result.success).toBe(true)
  })

  it('validates complete development env', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      READ_DATABASE_URL: 'postgresql://localhost:5432/test_read',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      EXCHANGE_RATE_API_KEY: 'test-key',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing DATABASE_URL', () => {
    const result = EnvSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid NODE_ENV value', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'staging',
    })
    expect(result.success).toBe(false)
  })

  it('validates valid NODE_ENV values', () => {
    for (const nodeEnv of ['development', 'test']) {
      const result = EnvSchema.safeParse({ ...baseEnv, NODE_ENV: nodeEnv })
      expect(result.success).toBe(true)
    }
  })

  it('requires app URL and auth secret in production when not in build phase', () => {
    vi.stubEnv('NEXT_PHASE', '')

    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('NEXT_PUBLIC_APP_URL')
      expect(paths).toContain('NEXTAUTH_SECRET')
    }
  })

  it('skips production key validation during build phase', () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')

    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
    })

    expect(result.success).toBe(true)
  })

  it('passes production validation with all required keys', () => {
    vi.stubEnv('NEXT_PHASE', '')

    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://example.com',
      NEXTAUTH_SECRET: 'super-secret-value',
    })

    expect(result.success).toBe(true)
  })

  it('rejects whitespace-only NEXTAUTH_SECRET in production', () => {
    vi.stubEnv('NEXT_PHASE', '')

    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://example.com',
      NEXTAUTH_SECRET: '   ', // whitespace only
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('NEXTAUTH_SECRET')
    }
  })

  it('rejects missing NEXTAUTH_SECRET in production', () => {
    vi.stubEnv('NEXT_PHASE', '')

    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://example.com',
      // NEXTAUTH_SECRET intentionally omitted
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('NEXTAUTH_SECRET')
    }
  })

  it('NEXTAUTH_SECRET is optional in development', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'development',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid AUTH_TRUST_HOST values', () => {
    for (const value of ['true', 'false']) {
      const result = EnvSchema.safeParse({
        ...baseEnv,
        AUTH_TRUST_HOST: value,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid AUTH_TRUST_HOST value', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      AUTH_TRUST_HOST: 'yes',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UPSTASH_REDIS_REST_URL (not a URL)', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      UPSTASH_REDIS_REST_URL: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid optional URLs', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
      UPSTASH_SEARCH_REST_URL: 'https://search.upstash.io',
      NEXT_PUBLIC_APP_URL: 'https://myapp.com',
    })
    expect(result.success).toBe(true)
  })
})

describe('EnvSchema — storage provider (S3 / R2 / Vercel)', () => {
  const baseEnv = { DATABASE_URL: 'postgresql://localhost:5432/test' }
  // Mirrors the private R2_REQUIRED_KEYS list in src/lib/validations/env.ts —
  // not imported (it isn't exported) so this test independently pins the
  // required-field contract.
  const R2_REQUIRED_KEYS_FOR_TEST = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_PUBLIC_BASE_URL',
  ] as const
  const validR2Env = {
    STORAGE_PROVIDER: 'r2',
    R2_ACCOUNT_ID: 'acct-1',
    R2_ACCESS_KEY_ID: 'key-1',
    R2_SECRET_ACCESS_KEY: 'secret-1',
    R2_BUCKET: 'images',
    R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
  }
  const validS3Env = {
    STORAGE_PROVIDER: 's3',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'images',
    S3_ACCESS_KEY_ID: 'key-1',
    S3_SECRET_ACCESS_KEY: 'secret-1',
    S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
  }

  it('accepts STORAGE_PROVIDER unset (defaults to vercel, no R2 vars required)', () => {
    const result = EnvSchema.safeParse({ ...baseEnv })
    expect(result.success).toBe(true)
  })

  it('accepts STORAGE_PROVIDER=vercel without any R2 vars', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      STORAGE_PROVIDER: 'vercel',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown STORAGE_PROVIDER value', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      STORAGE_PROVIDER: 'azure',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a fully configured STORAGE_PROVIDER=r2 environment', () => {
    const result = EnvSchema.safeParse({ ...baseEnv, ...validR2Env })
    expect(result.success).toBe(true)
  })

  it('accepts a fully configured STORAGE_PROVIDER=s3 environment', () => {
    const result = EnvSchema.safeParse({ ...baseEnv, ...validS3Env })
    expect(result.success).toBe(true)
  })

  it.each(R2_REQUIRED_KEYS_FOR_TEST.map((key) => [key]))(
    'rejects STORAGE_PROVIDER=r2 missing %s',
    (key) => {
      const { [key]: _omitted, ...rest } = validR2Env
      const result = EnvSchema.safeParse({ ...baseEnv, ...rest })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0])
        expect(paths).toContain(key)
      }
    }
  )

  it('rejects STORAGE_PROVIDER=r2 with a whitespace-only R2 field', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      ...validR2Env,
      R2_BUCKET: '   ',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('R2_BUCKET')
    }
  })

  it('does not require R2 vars when STORAGE_PROVIDER=r2 is absent, even if some R2 vars are set', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      R2_ACCOUNT_ID: 'acct-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts STORAGE_PROVIDER=s3 with deprecated R2_* alias variables', () => {
    const result = EnvSchema.safeParse({ ...baseEnv, ...validR2Env, STORAGE_PROVIDER: 's3' })
    expect(result.success).toBe(true)
  })

  it('rejects an Inngest event key without a signing key', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      INNGEST_EVENT_KEY: 'evt-key',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['INNGEST_SIGNING_KEY'])
    }
  })

  it('accepts a complete Inngest configuration', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      INNGEST_EVENT_KEY: 'evt-key',
      INNGEST_SIGNING_KEY: 'signkey-prod-abc',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an environment with Inngest fully absent', () => {
    const result = EnvSchema.safeParse({ ...baseEnv })
    expect(result.success).toBe(true)
  })
})

describe('EnvSchema — provider selectors', () => {
  const baseEnv = { DATABASE_URL: 'postgresql://localhost:5432/test' }

  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['DATABASE_DRIVER', 'postgres', {}],
    ['DATABASE_DRIVER', 'neon', {}],
    ['CACHE_PROVIDER', 'none', {}],
    ['CACHE_PROVIDER', 'redis', { REDIS_URL: 'redis://localhost:6379' }],
    [
      'CACHE_PROVIDER',
      'upstash',
      {
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
      },
    ],
    ['SEARCH_PROVIDER', 'postgres', {}],
    [
      'SEARCH_PROVIDER',
      'algolia',
      {
        ALGOLIA_APP_ID: 'app',
        ALGOLIA_API_KEY: 'key',
        ALGOLIA_INDEX_NAME: 'products',
      },
    ],
    [
      'SEARCH_PROVIDER',
      'upstash',
      {
        UPSTASH_SEARCH_REST_URL: 'https://search.upstash.io',
        UPSTASH_SEARCH_REST_TOKEN: 'token',
      },
    ],
    [
      'STORAGE_PROVIDER',
      's3',
      {
        S3_REGION: 'eu-central-1',
        S3_BUCKET: 'images',
        S3_ACCESS_KEY_ID: 'access',
        S3_SECRET_ACCESS_KEY: 'secret',
        S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
      },
    ],
    ['RATE_LIMIT_PROVIDER', 'memory', {}],
    ['RATE_LIMIT_PROVIDER', 'redis', { REDIS_URL: 'redis://localhost:6379' }],
    ['CONFIG_PROVIDER', 'environment', {}],
    ['CONFIG_PROVIDER', 'edge-config', { EDGE_CONFIG: 'https://ec.test/id' }],
    ['JOBS_PROVIDER', 'inline', {}],
    [
      'JOBS_PROVIDER',
      'inngest',
      { INNGEST_EVENT_KEY: 'evt', INNGEST_SIGNING_KEY: 'sign' },
    ],
  ])('accepts %s=%s with its credentials', (selector, value, credentials) => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      [selector]: value,
      ...credentials,
    })
    expect(result.success).toBe(true)
  })

  it.each([
    ['CACHE_PROVIDER', 'redis', 'REDIS_URL'],
    ['SEARCH_PROVIDER', 'algolia', 'ALGOLIA_APP_ID'],
    ['RATE_LIMIT_PROVIDER', 'upstash', 'UPSTASH_REDIS_REST_URL'],
    ['CONFIG_PROVIDER', 'edge-config', 'EDGE_CONFIG'],
    ['JOBS_PROVIDER', 'inngest', 'INNGEST_EVENT_KEY'],
    ['STORAGE_PROVIDER', 's3', 'S3_BUCKET'],
  ])(
    'rejects %s=%s with an error on the missing %s field',
    (selector, value, missingField) => {
      const result = EnvSchema.safeParse({ ...baseEnv, [selector]: value })

      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((issue) => issue.path[0])
        expect(paths).toContain(missingField)
      }
    }
  )

  it('rejects an unknown selector value', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      CACHE_PROVIDER: 'memcached',
    })
    expect(result.success).toBe(false)
  })

  it('defers provider credential validation during the production build phase', () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')

    const result = EnvSchema.safeParse({
      ...baseEnv,
      CACHE_PROVIDER: 'redis',
      STORAGE_PROVIDER: 'r2',
    })

    expect(result.success).toBe(true)
  })

  it('accepts an existing deployment that sets no selectors at all', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      READ_DATABASE_URL: 'postgresql://localhost:5432/read',
      UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
      UPSTASH_SEARCH_REST_URL: 'https://search.upstash.io',
      UPSTASH_SEARCH_REST_TOKEN: 'token',
      INNGEST_EVENT_KEY: 'evt',
      INNGEST_SIGNING_KEY: 'sign',
    })
    expect(result.success).toBe(true)
  })
})
