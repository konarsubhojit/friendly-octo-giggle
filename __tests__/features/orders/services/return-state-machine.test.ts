import { describe, expect, it } from 'vitest'
import {
  RETURN_TRANSITIONS,
  ReturnTransitionError,
  assertTransition,
  canTransition,
  isTerminalReturnStatus,
  nextReturnStatus,
} from '@/features/orders/services/return-state-machine'
import { RETURN_ACTIONS, RETURN_STATUSES } from '@/lib/constants/returns'

describe('nextReturnStatus', () => {
  it('advances a requested return to approved', () => {
    expect(nextReturnStatus('REQUESTED', 'approve')).toBe('APPROVED')
  })

  it('rejects from both REQUESTED and APPROVED', () => {
    expect(nextReturnStatus('REQUESTED', 'reject')).toBe('REJECTED')
    expect(nextReturnStatus('APPROVED', 'reject')).toBe('REJECTED')
  })

  it('receives goods without issuing a refund', () => {
    expect(nextReturnStatus('APPROVED', 'receive')).toBe('RECEIVED')
  })

  it('refunds only from RECEIVED', () => {
    expect(nextReturnStatus('RECEIVED', 'refund')).toBe('REFUNDED')
  })

  it('allows settle on an already refunded return', () => {
    // Cash on Delivery: the refund row exists as PENDING and is flipped to
    // PROCESSED by hand, so the status does not move.
    expect(nextReturnStatus('REFUNDED', 'settle')).toBe('REFUNDED')
  })

  it('returns null for every illegal transition', () => {
    expect(nextReturnStatus('REQUESTED', 'receive')).toBeNull()
    expect(nextReturnStatus('REQUESTED', 'refund')).toBeNull()
    expect(nextReturnStatus('REQUESTED', 'settle')).toBeNull()
    expect(nextReturnStatus('APPROVED', 'approve')).toBeNull()
    expect(nextReturnStatus('APPROVED', 'refund')).toBeNull()
    expect(nextReturnStatus('RECEIVED', 'approve')).toBeNull()
    expect(nextReturnStatus('RECEIVED', 'reject')).toBeNull()
    expect(nextReturnStatus('RECEIVED', 'receive')).toBeNull()
    expect(nextReturnStatus('REFUNDED', 'refund')).toBeNull()
    expect(nextReturnStatus('REFUNDED', 'receive')).toBeNull()
  })

  it('permits no action at all from REJECTED', () => {
    for (const action of RETURN_ACTIONS) {
      expect(nextReturnStatus('REJECTED', action)).toBeNull()
    }
  })
})

describe('refund retry after a gateway failure', () => {
  it('keeps refund legal from RECEIVED so a failed attempt can be retried', () => {
    // A gateway rejection rolls the status change back and leaves the return
    // at RECEIVED. If refund were not legal from RECEIVED the return would be
    // stranded with no action accepting its state — the exact dead end this
    // split exists to avoid.
    expect(canTransition('RECEIVED', 'refund')).toBe(true)
    expect(nextReturnStatus('RECEIVED', 'refund')).toBe('REFUNDED')
  })
})

describe('assertTransition', () => {
  it('returns the next status for a legal transition', () => {
    expect(assertTransition('APPROVED', 'receive')).toBe('RECEIVED')
  })

  it('throws ReturnTransitionError for an illegal transition', () => {
    expect(() => assertTransition('REQUESTED', 'refund')).toThrow(
      ReturnTransitionError
    )
  })

  it('reports the current status and attempted action on the error', () => {
    try {
      assertTransition('REJECTED', 'approve')
      expect.unreachable('assertTransition should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ReturnTransitionError)
      const transitionError = error as ReturnTransitionError
      expect(transitionError.currentStatus).toBe('REJECTED')
      expect(transitionError.action).toBe('approve')
      expect(transitionError.message).toContain('REJECTED')
      expect(transitionError.message).toContain('approve')
    }
  })
})

describe('isTerminalReturnStatus', () => {
  it('treats REJECTED as terminal', () => {
    expect(isTerminalReturnStatus('REJECTED')).toBe(true)
  })

  it('does not treat REFUNDED as terminal, because settle remains available', () => {
    expect(isTerminalReturnStatus('REFUNDED')).toBe(false)
  })

  it('treats in-flight states as non-terminal', () => {
    expect(isTerminalReturnStatus('REQUESTED')).toBe(false)
    expect(isTerminalReturnStatus('APPROVED')).toBe(false)
    expect(isTerminalReturnStatus('RECEIVED')).toBe(false)
  })
})

describe('transition table shape', () => {
  it('declares an entry for every status', () => {
    for (const status of RETURN_STATUSES) {
      expect(RETURN_TRANSITIONS).toHaveProperty(status)
    }
  })

  it('only ever targets a known status', () => {
    for (const action of Object.values(RETURN_TRANSITIONS)) {
      for (const target of Object.values(action)) {
        if (target === undefined) continue
        expect(RETURN_STATUSES).toContain(target)
      }
    }
  })
})
