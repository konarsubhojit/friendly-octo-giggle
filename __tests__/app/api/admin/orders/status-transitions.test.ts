import { describe, expect, it } from 'vitest'
import {
  VALID_ORDER_TRANSITIONS,
  isTerminalOrderStatus,
} from '@/features/orders/services/order-status-transitions'

describe('order status transitions', () => {
  it('keeps DELIVERED terminal', () => {
    // Self-service returns hang off a delivered order. If a delivered order
    // could move backwards and be delivered again, a second delivery
    // settlement — and so a second refund path — could open against the same
    // order. Terminal makes the double refund structurally impossible.
    expect(isTerminalOrderStatus('DELIVERED')).toBe(true)
  })

  it('never routes DELIVERED back to an earlier state', () => {
    expect(VALID_ORDER_TRANSITIONS.DELIVERED).not.toContain('SHIPPED')
    expect(VALID_ORDER_TRANSITIONS.DELIVERED).not.toContain('PROCESSING')
    expect(VALID_ORDER_TRANSITIONS.DELIVERED).not.toContain('CANCELLED')
  })

  it('keeps CANCELLED terminal', () => {
    expect(isTerminalOrderStatus('CANCELLED')).toBe(true)
  })

  it('reaches DELIVERED only from SHIPPED', () => {
    const sources = Object.entries(VALID_ORDER_TRANSITIONS)
      .filter(
        ([from, next]) => from !== 'DELIVERED' && next.includes('DELIVERED')
      )
      .map(([from]) => from)

    expect(sources).toEqual(['SHIPPED'])
  })

  it('treats an unknown status as terminal rather than permissive', () => {
    expect(isTerminalOrderStatus('NOT_A_STATUS')).toBe(true)
  })

  it('allows forward progress from the open states', () => {
    expect(isTerminalOrderStatus('PENDING')).toBe(false)
    expect(isTerminalOrderStatus('PROCESSING')).toBe(false)
    expect(isTerminalOrderStatus('SHIPPED')).toBe(false)
  })
})
