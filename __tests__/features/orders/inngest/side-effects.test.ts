import { describe, it, expect } from 'vitest'

import {
  orderCacheInvalidateInvoke,
  orderSearchIndexInvoke,
} from '@/features/orders/inngest/events'
import {
  indexOrderForSearchFunction,
  invalidateOrderCachesFunction,
} from '@/features/orders/inngest/side-effects'

type FnInternals = {
  opts: { id: string; triggers: unknown[] }
}

const internals = (fn: unknown) => fn as unknown as FnInternals

const validate = async (schema: unknown, data: unknown) => {
  const standard = (
    schema as {
      ['~standard']: {
        validate: (value: unknown) => Promise<{ issues?: readonly unknown[] }>
      }
    }
  )['~standard']
  return standard.validate(data)
}

describe('order side-effect invoke contracts', () => {
  it('lets a re-index invoke carry only the order id', async () => {
    const triggers = internals(indexOrderForSearchFunction).opts.triggers
    expect(triggers).toContain(orderSearchIndexInvoke)
    expect(orderSearchIndexInvoke.name).toBe('inngest/function.invoked')

    const result = await validate(orderSearchIndexInvoke.schema, {
      orderId: 'aB3xY7z',
    })
    expect(result.issues).toBeUndefined()
  })

  it('rejects a re-index invoke without an order id', async () => {
    const result = await validate(orderSearchIndexInvoke.schema, {})
    expect(result.issues).toBeDefined()
  })

  it('states the cache-invalidation invoke contract', async () => {
    const triggers = internals(invalidateOrderCachesFunction).opts.triggers
    expect(triggers).toContain(orderCacheInvalidateInvoke)

    const result = await validate(orderCacheInvalidateInvoke.schema, {
      orderId: 'aB3xY7z',
      productIds: ['p1'],
    })
    expect(result.issues).toBeUndefined()
  })
})
