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

  it('requires QStash keys in production when not in build phase', () => {
    vi.stubEnv('NEXT_PHASE', '')

    const result = EnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('QSTASH_TOKEN')
      expect(paths).toContain('QSTASH_CURRENT_SIGNING_KEY')
      expect(paths).toContain('QSTASH_NEXT_SIGNING_KEY')
      expect(paths).toContain('NEXT_PUBLIC_APP_URL')
      expect(paths).toContain('NEXTAUTH_SECRET')
    }
  })

  it('skips QStash validation during build phase', () => {
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
      QSTASH_TOKEN: 'tok_test',
      QSTASH_CURRENT_SIGNING_KEY: 'sig_current',
      QSTASH_NEXT_SIGNING_KEY: 'sig_next',
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
      QSTASH_TOKEN: 'tok_test',
      QSTASH_CURRENT_SIGNING_KEY: 'sig_current',
      QSTASH_NEXT_SIGNING_KEY: 'sig_next',
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
      QSTASH_TOKEN: 'tok_test',
      QSTASH_CURRENT_SIGNING_KEY: 'sig_current',
      QSTASH_NEXT_SIGNING_KEY: 'sig_next',
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

describe('EnvSchema — Azure Blob upload provider', () => {
  const baseEnv = { DATABASE_URL: 'postgresql://localhost:5432/test' }
  const validAccounts = JSON.stringify([
    { alias: 'primary', connectionString: 'c1', container: 'images' },
    { alias: 'secondary', connectionString: 'c2', container: 'images-2' },
  ])

  it('rejects malformed AZURE_BLOB_ACCOUNTS_JSON', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      AZURE_BLOB_ACCOUNTS_JSON: '{not json',
    })
    expect(result.success).toBe(false)
  })

  it('rejects AZURE_BLOB_ACCOUNTS_JSON that is not an array', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      AZURE_BLOB_ACCOUNTS_JSON: JSON.stringify({ alias: 'x' }),
    })
    expect(result.success).toBe(false)
  })

  it('rejects array entries missing required string fields', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      AZURE_BLOB_ACCOUNTS_JSON: JSON.stringify([
        { alias: 'x', container: 'c' },
      ]),
    })
    expect(result.success).toBe(false)
  })

  it('accepts an empty string AZURE_BLOB_ACCOUNTS_JSON', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      AZURE_BLOB_ACCOUNTS_JSON: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects azure provider without AZURE_BLOB_ACCOUNTS_JSON', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      IMAGE_UPLOAD_PROVIDER: 'azure',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('AZURE_BLOB_ACCOUNTS_JSON')
    }
  })

  it('rejects azure provider with an empty accounts array', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      IMAGE_UPLOAD_PROVIDER: 'azure',
      AZURE_BLOB_ACCOUNTS_JSON: JSON.stringify([]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a default account alias that is not in the accounts list', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      IMAGE_UPLOAD_PROVIDER: 'azure',
      AZURE_BLOB_ACCOUNTS_JSON: validAccounts,
      AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS: 'tertiary',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS')
    }
  })

  it('accepts a valid azure configuration', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      IMAGE_UPLOAD_PROVIDER: 'azure',
      AZURE_BLOB_ACCOUNTS_JSON: validAccounts,
      AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS: 'secondary',
      AZURE_BLOB_AUTO_CREATE_CONTAINER: 'true',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown IMAGE_UPLOAD_PROVIDER values', () => {
    const result = EnvSchema.safeParse({
      ...baseEnv,
      IMAGE_UPLOAD_PROVIDER: 's3',
    })
    expect(result.success).toBe(false)
  })
})
