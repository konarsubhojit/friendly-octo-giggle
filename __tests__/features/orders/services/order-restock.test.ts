import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ primaryDrizzleDb: { transaction: vi.fn() } }))
vi.mock('@/lib/schema', () => ({
  orders: { id: 'id', stockRestoredAt: 'stockRestoredAt' },
  productVariants: { id: 'id', stock: 'stock' },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((...args) => args),
  isNull: vi.fn((...args) => args),
  sql: vi.fn((...args) => args),
}))

import { restockOrderItems } from '@/features/orders/services/order-restock'

/** Transaction stub whose order claim returns `claimed` rows. */
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

const order = {
  id: 'order1',
  items: [
    { variantId: 'v1', quantity: 2 },
    { variantId: 'v2', quantity: 1 },
  ],
}

describe('restockOrderItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('credits every item when it claims the restock', async () => {
    const { tx, update, variantWhere } = makeTx([{ id: 'order1' }])

    await expect(restockOrderItems(tx as never, order)).resolves.toBe(true)
    // one claim on the order plus one update per item
    expect(update).toHaveBeenCalledTimes(3)
    expect(variantWhere).toHaveBeenCalledTimes(2)
  })

  it('is a no-op when the stock was already restored', async () => {
    const { tx, update, variantWhere } = makeTx([])

    await expect(restockOrderItems(tx as never, order)).resolves.toBe(false)
    expect(update).toHaveBeenCalledTimes(1)
    expect(variantWhere).not.toHaveBeenCalled()
  })

  it('claims the restock for an order without items', async () => {
    const { tx, variantWhere } = makeTx([{ id: 'order1' }])

    await expect(
      restockOrderItems(tx as never, { id: 'order1', items: [] })
    ).resolves.toBe(true)
    expect(variantWhere).not.toHaveBeenCalled()
  })
})
