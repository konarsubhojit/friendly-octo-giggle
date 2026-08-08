import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ primaryDrizzleDb: { transaction: vi.fn() } }))
vi.mock('@/lib/schema', () => ({
  orders: { id: 'id', stockRestoredAt: 'stockRestoredAt' },
  returnRequests: { id: 'id', stockRestoredAt: 'stockRestoredAt' },
  productVariants: { id: 'id', stock: 'stock', reservedStock: 'reservedStock' },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((...args) => args),
  isNull: vi.fn((...args) => args),
  sql: vi.fn((...args) => args),
}))

import { restockReturnItems } from '@/features/orders/services/return-restock'

/** Transaction stub whose return claim yields `claimed` rows. */
const makeTx = (claimed: unknown[]) => {
  const variantWhere = vi.fn(async () => undefined)
  const update = vi.fn((table: { id: string; stock?: string }) => ({
    set: vi.fn(() => ({
      where: vi.fn((...args: unknown[]) =>
        table.stock
          ? variantWhere(...(args as []))
          : { returning: vi.fn(async () => claimed) }
      ),
    })),
  }))
  return { tx: { update }, update, variantWhere }
}

const returnRequest = {
  id: 'ret0001',
  items: [
    { variantId: 'v1', quantity: 2 },
    { variantId: 'v2', quantity: 1 },
  ],
}

describe('restockReturnItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('credits every returned unit when it claims the restock', async () => {
    const { tx, update, variantWhere } = makeTx([{ id: 'ret0001' }])

    await expect(restockReturnItems(tx as never, returnRequest)).resolves.toBe(
      true
    )
    // one claim on the return plus one update per item
    expect(update).toHaveBeenCalledTimes(3)
    expect(variantWhere).toHaveBeenCalledTimes(2)
  })

  it('is a no-op when the return was already restocked', async () => {
    const { tx, update, variantWhere } = makeTx([])

    await expect(restockReturnItems(tx as never, returnRequest)).resolves.toBe(
      false
    )
    // Only the failed claim runs; no variant is touched a second time.
    expect(update).toHaveBeenCalledTimes(1)
    expect(variantWhere).not.toHaveBeenCalled()
  })

  it('claims the return timestamp, never the order-level one', async () => {
    // Consuming `Order.stockRestoredAt` here would permanently block any later
    // restock for that order, including a second return against it.
    const claimedTables: Array<Record<string, unknown>> = []
    const tx = {
      update: (table: Record<string, unknown>) => ({
        set: () => {
          claimedTables.push(table)
          return {
            where: () => ({
              returning: async () => [{ id: 'ret0001' }],
            }),
          }
        },
      }),
    }

    await restockReturnItems(tx as never, { id: 'ret0001', items: [] })

    const { returnRequests, orders } = await import('@/lib/schema')
    expect(claimedTables[0]).toBe(returnRequests)
    expect(claimedTables).not.toContain(orders)
  })

  it('credits on-hand stock only, never the reservation counter', async () => {
    // `reservedStock` tracks live checkout holds. A returned unit belongs to a
    // completed order and is held by nobody, so touching that counter would
    // hide the stock from shoppers.
    const variantSets: Array<Record<string, unknown>> = []
    const tx = {
      update: (table: { id: string; stock?: string }) => ({
        set: (payload: Record<string, unknown>) => {
          if (table.stock) variantSets.push(payload)
          return {
            where: () => ({
              returning: async () => [{ id: 'ret0001' }],
            }),
          }
        },
      }),
    }

    await restockReturnItems(tx as never, returnRequest)

    expect(variantSets).toHaveLength(2)
    for (const payload of variantSets) {
      expect(payload).toHaveProperty('stock')
      expect(payload).not.toHaveProperty('reservedStock')
    }
  })

  it('restocks soft-deleted variants like any other', async () => {
    // The units physically came back regardless of whether the variant is
    // still sellable, so the where-clause filters on id alone.
    const whereArgs: unknown[] = []
    const tx = {
      update: (table: { id: string; stock?: string }) => ({
        set: () => ({
          where: (...args: unknown[]) => {
            if (table.stock) whereArgs.push(args)
            return { returning: async () => [{ id: 'ret0001' }] }
          },
        }),
      }),
    }

    await restockReturnItems(tx as never, returnRequest)

    expect(whereArgs).toHaveLength(2)
    const { eq } = await import('drizzle-orm')
    // Only an id equality — no deletedAt predicate is ever added.
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'v1')
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'v2')
  })
})
