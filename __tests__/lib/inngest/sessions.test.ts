import { describe, it, expect } from 'vitest'
import {
  MAX_SESSIONS_PER_EVENT,
  SESSION_KEYS,
  cartSession,
  checkoutSession,
  mergeSessions,
  orderSession,
  threadSession,
} from '@/lib/inngest/sessions'

describe('session builders', () => {
  it('builds a session for each supported domain entity', () => {
    expect(checkoutSession('cr12345')).toEqual({
      [SESSION_KEYS.checkoutRequest]: 'cr12345',
    })
    expect(orderSession('ord1234')).toEqual({ [SESSION_KEYS.order]: 'ord1234' })
    expect(cartSession('crt1234')).toEqual({ [SESSION_KEYS.cart]: 'crt1234' })
    expect(threadSession('thr1234')).toEqual({
      [SESSION_KEYS.thread]: 'thr1234',
    })
  })

  it('trims surrounding whitespace rather than creating a distinct session', () => {
    expect(orderSession('  ord1234  ')).toEqual({
      [SESSION_KEYS.order]: 'ord1234',
    })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('omits the session when the id is %s', (_label, value) => {
    expect(orderSession(value)).toEqual({})
  })

  it('omits an id that exceeds the 512-byte platform limit', () => {
    expect(orderSession('a'.repeat(512))).toEqual({
      [SESSION_KEYS.order]: 'a'.repeat(512),
    })
    // Rejected rather than truncated: a truncated id would silently merge
    // unrelated entities into one session.
    expect(orderSession('a'.repeat(513))).toEqual({})
  })

  it('measures the id limit in bytes, not characters', () => {
    // Each emoji is 4 UTF-8 bytes, so 129 of them exceed 512 bytes despite
    // being well under 512 JS string units.
    expect(orderSession('😀'.repeat(129))).toEqual({})
  })
})

describe('mergeSessions', () => {
  it('combines fragments from several builders', () => {
    expect(mergeSessions(orderSession('ord1'), checkoutSession('cr1'))).toEqual(
      {
        [SESSION_KEYS.order]: 'ord1',
        [SESSION_KEYS.checkoutRequest]: 'cr1',
      }
    )
  })

  it('ignores undefined and empty fragments', () => {
    expect(mergeSessions(undefined, {}, orderSession('ord1'))).toEqual({
      [SESSION_KEYS.order]: 'ord1',
    })
  })

  it('returns undefined when nothing usable is supplied', () => {
    expect(mergeSessions(undefined, {}, orderSession(null))).toBeUndefined()
  })

  it('keeps the first value for a repeated key', () => {
    expect(
      mergeSessions(orderSession('first'), orderSession('second'))
    ).toEqual({ [SESSION_KEYS.order]: 'first' })
  })

  it('drops entries past the per-event cap, keeping the earliest', () => {
    const fragments = Array.from(
      { length: MAX_SESSIONS_PER_EVENT + 2 },
      (_v, i) => ({
        [`key_${i}`]: `id_${i}`,
      })
    )

    const merged = mergeSessions(...fragments)

    expect(Object.keys(merged ?? {})).toHaveLength(MAX_SESSIONS_PER_EVENT)
    expect(merged).toHaveProperty('key_0', 'id_0')
    expect(merged).not.toHaveProperty(`key_${MAX_SESSIONS_PER_EVENT}`)
  })
})
