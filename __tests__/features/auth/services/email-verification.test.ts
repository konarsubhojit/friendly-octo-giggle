import { describe, it, expect } from 'vitest'
import {
  createEmailVerificationIdentifier,
  parseEmailVerificationIdentifier,
  hashEmailVerificationToken,
  generateEmailVerificationToken,
} from '@/features/auth/services/email-verification'

describe('email-verification token helpers', () => {
  it('createEmailVerificationIdentifier prefixes user ids', () => {
    expect(createEmailVerificationIdentifier('user-1')).toBe(
      'email-verify:user-1'
    )
  })

  it('parseEmailVerificationIdentifier strips the prefix', () => {
    expect(parseEmailVerificationIdentifier('email-verify:abc')).toBe('abc')
  })

  it('parseEmailVerificationIdentifier returns null on unrelated input', () => {
    expect(parseEmailVerificationIdentifier('password-reset:abc')).toBeNull()
    expect(parseEmailVerificationIdentifier('')).toBeNull()
  })

  it('hashEmailVerificationToken returns a deterministic sha256 hex', () => {
    const hash = hashEmailVerificationToken('token')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashEmailVerificationToken('token')).toBe(hash)
    expect(hashEmailVerificationToken('different')).not.toBe(hash)
  })

  it('generateEmailVerificationToken returns matching plain/hash and a future expiry', () => {
    const before = Date.now()
    const { plainToken, tokenHash, expiresAt } =
      generateEmailVerificationToken()
    const after = Date.now()

    expect(plainToken).toMatch(/^[0-9a-f]{64}$/) // 32 bytes hex
    expect(tokenHash).toBe(hashEmailVerificationToken(plainToken))

    const expiresMs = expiresAt.getTime()
    const ttl = 30 * 60 * 1000
    expect(expiresMs).toBeGreaterThanOrEqual(before + ttl)
    expect(expiresMs).toBeLessThanOrEqual(after + ttl)
  })

  it('generates unique tokens on subsequent calls', () => {
    const a = generateEmailVerificationToken()
    const b = generateEmailVerificationToken()
    expect(a.plainToken).not.toBe(b.plainToken)
  })
})
