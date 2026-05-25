import { describe, expect, it, beforeEach } from 'vitest'
import {
  createGuestCartSessionId,
  signCartSessionCookieValue,
  verifyCartSessionCookieValue,
} from '@/features/cart/services/cart-session'

describe('cart-session helpers', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-nextauth-secret'
  })

  it('signs and verifies a cart session cookie value', () => {
    const signedValue = signCartSessionCookieValue('guest-session-123')

    expect(verifyCartSessionCookieValue(signedValue)).toBe('guest-session-123')
  })

  it('rejects tampered cookie values', () => {
    const signedValue = signCartSessionCookieValue('guest-session-123')
    const tamperedValue = signedValue.replace(
      'guest-session-123',
      'other-session'
    )

    expect(verifyCartSessionCookieValue(tamperedValue)).toBeUndefined()
  })

  it('rejects unsigned cookie values', () => {
    expect(verifyCartSessionCookieValue('guest-session-123')).toBeUndefined()
  })

  it('creates opaque guest cart session identifiers', () => {
    const sessionId = createGuestCartSessionId()

    expect(sessionId).toMatch(/^guest_\d+_[0-9a-f-]+$/)
  })

  it('creates unique guest cart session identifiers', () => {
    const sessionIds = new Set(
      Array.from({ length: 5 }, () => createGuestCartSessionId())
    )

    expect(sessionIds.size).toBe(5)
  })
})
