import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_POLICIES,
  CHECKOUT_POLICY_ACKNOWLEDGMENT,
  CHECKOUT_POLICY_ERROR_MESSAGE,
  SUPPORT_EMAIL,
} from '@/lib/constants/checkout-policies'

describe('checkout policies', () => {
  it('uses the canonical support email', () => {
    expect(SUPPORT_EMAIL).toBe('support@estore.example.com')
  })

  it('includes the no-cancellation-after-shipment rule', () => {
    expect(CHECKOUT_POLICIES.cancellation.items.join(' ')).toContain(
      'cannot be cancelled and no refund will be issued'
    )
  })

  it('includes the damaged-only return exception', () => {
    const returns = CHECKOUT_POLICIES.returns.items.join(' ')
    expect(returns).toContain(
      'cannot be returned unless the product is received'
    )
    expect(returns).toContain('damaged, defective, or incorrect')
    // The claim is raised in product now, not by emailing support.
    expect(returns).toContain('from the order page')
    expect(returns).toContain('short video')
  })

  it('reserves refunds for approved damage claims', () => {
    const refunds = CHECKOUT_POLICIES.refunds.items.join(' ')
    // Refunds are still refused for change of mind — the exception is narrow.
    expect(refunds).toContain('Refunds are not issued for change of mind')
    expect(refunds).toContain('normally resolved by replacement')
    // Where replacement is impossible the claim must still be settleable, or
    // an approved claim would have no outcome at all.
    expect(refunds).toContain('settled by refund')
  })

  it('includes damaged-item contact and shipping responsibilities', () => {
    const damagedItems = CHECKOUT_POLICIES.damagedItems.items.join(' ')
    expect(damagedItems).toContain(SUPPORT_EMAIL)
    expect(damagedItems).toContain('short video')
    expect(damagedItems).toContain(
      'shipping cost to send the damaged product back'
    )
    expect(damagedItems).toContain('replacement product')
  })

  it('defines the acknowledgment and fallback error messages', () => {
    expect(CHECKOUT_POLICY_ACKNOWLEDGMENT).toContain('reviewed')
    expect(CHECKOUT_POLICY_ERROR_MESSAGE).toContain('unavailable')
  })
})
