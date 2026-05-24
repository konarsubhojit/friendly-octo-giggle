import { describe, expect, it } from 'vitest'
import { assertOwnership } from '@/lib/ownership'

describe('assertOwnership', () => {
  it('returns true for matching authenticated user', () => {
    expect(
      assertOwnership({ userId: 'user-1' }, { user: { id: 'user-1' } })
    ).toBe(true)
  })

  it('returns false for non-matching authenticated user', () => {
    expect(
      assertOwnership({ userId: 'user-1' }, { user: { id: 'user-2' } })
    ).toBe(false)
  })

  it('returns true for matching guest cart session', () => {
    expect(
      assertOwnership(
        { userId: null, sessionId: 'guest-1' },
        null,
        { sessionId: 'guest-1' }
      )
    ).toBe(true)
  })

  it('returns false for guest cart session mismatch', () => {
    expect(
      assertOwnership(
        { userId: null, sessionId: 'guest-1' },
        null,
        { sessionId: 'guest-2' }
      )
    ).toBe(false)
  })
})
