import { describe, it, expect } from 'vitest'
import {
  cronFunctions,
  cronJobFlags,
  eventFunctions,
  inngestFunctions,
} from '@/lib/inngest/registry'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/edge-config'

/** Every function the migration depends on. A missing id means dead code. */
const EXPECTED_FUNCTION_IDS = [
  'process-checkout-request',
  'send-order-confirmation-email',
  'send-order-status-email',
  'send-return-status-email',
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
  'compute-product-affinity',
  'cart-recovery-scorer',
  'activity-retention',
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

  it('maps every registered cron function to a dedicated default-off flag', () => {
    const cronIds = cronFunctions
      .filter((fn) =>
        (
          fn as unknown as { opts: { triggers: Array<{ cron?: string }> } }
        ).opts.triggers.some((trigger) => trigger.cron)
      )
      .map((fn) => (fn as unknown as { opts: { id: string } }).opts.id)

    expect(cronIds.sort()).toEqual(Object.keys(cronJobFlags).sort())
    for (const flag of Object.values(cronJobFlags)) {
      expect(DEFAULT_FEATURE_FLAGS[flag]).toBe(false)
    }
  })

  it('splits cron functions from event functions', () => {
    expect(eventFunctions).not.toContainEqual(
      expect.objectContaining({
        opts: expect.objectContaining({
          triggers: expect.arrayContaining([
            expect.objectContaining({ cron: expect.any(String) }),
          ]),
        }),
      })
    )
    expect(inngestFunctions).toEqual([...eventFunctions, ...cronFunctions])
  })
})
