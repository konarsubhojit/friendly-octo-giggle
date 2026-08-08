import { describe, it, expect } from 'vitest'
import { inngestFunctions } from '@/lib/inngest/registry'

/** Every function the migration depends on. A missing id means dead code. */
const EXPECTED_FUNCTION_IDS = [
  'process-checkout-request',
  'send-order-confirmation-email',
  'send-order-status-email',
  'send-order-refund-email',
  'send-auth-email',
  'index-order-for-search',
  'invalidate-order-caches',
  'retry-failed-emails',
  'retry-single-email',
  'scan-abandoned-carts',
  'send-abandoned-cart-reminder',
  'refresh-exchange-rates',
  'expire-stock-reservations',
  'cart-recovery-scorer',
]

const functionIds = () =>
  inngestFunctions.map(
    (fn) => (fn as unknown as { opts: { id: string } }).opts.id
  )

describe('inngest registry', () => {
  it('registers every migrated workflow', () => {
    // An unregistered function compiles and publishes events but never runs,
    // so this list is the only thing standing between a rename and silently
    // dropped work.
    expect(functionIds().sort()).toEqual([...EXPECTED_FUNCTION_IDS].sort())
  })

  it('has no duplicate function ids', () => {
    const ids = functionIds()
    expect(new Set(ids).size).toBe(ids.length)
  })
})
