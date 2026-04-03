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
    })

    expect(result.success).toBe(true)
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
