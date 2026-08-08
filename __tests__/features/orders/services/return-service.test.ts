import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockTransaction,
  mockFindFirst,
  mockSelect,
  mockGetReturnsConfig,
  mockLogBusinessEvent,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockGetReturnsConfig: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    transaction: mockTransaction,
    select: mockSelect,
    query: { orders: { findFirst: mockFindFirst } },
  },
}))

vi.mock('@/lib/edge-config', () => ({
  getReturnsConfig: mockGetReturnsConfig,
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: vi.fn(),
}))

import {
  ReturnRequestError,
  createReturnRequest,
  getReturnEligibility,
} from '@/features/orders/services/return-service'

const DAY = 24 * 60 * 60 * 1000

const defaultConfig = {
  defaultWindowDays: 7,
  categoryWindowDays: {} as Record<string, number>,
  nonReturnableCategoryNames: [] as string[],
}

/** Chainable select stub returning `rows` when awaited. */
const selectReturning = (rows: unknown[]) => {
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'innerJoin', 'where', 'limit']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.for = vi.fn(() => Promise.resolve(rows))
  chain.then = (resolve: (value: unknown) => unknown) => resolve(rows)
  return chain
}

const orderWithItems = (overrides: Record<string, unknown> = {}) => ({
  id: 'ORD1234567',
  userId: 'user-1',
  status: 'DELIVERED',
  deliveredAt: new Date(Date.now() - DAY),
  items: [
    {
      id: 'itemAAA',
      productId: 'prodAAA',
      variantId: 'varAAAA',
      quantity: 3,
      price: 100,
      product: { category: 'Mugs', name: 'Ceramic Mug' },
    },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetReturnsConfig.mockResolvedValue(defaultConfig)
  mockSelect.mockReturnValue(selectReturning([]))
})

describe('getReturnEligibility', () => {
  it('reports an order owned by someone else as missing, not forbidden', async () => {
    // 403 would confirm the identifier exists, turning the endpoint into an
    // oracle for enumerating order ids.
    mockFindFirst.mockResolvedValue(orderWithItems({ userId: 'other-user' }))

    await expect(
      getReturnEligibility('ORD1234567', 'user-1')
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rejects an unknown order as missing', async () => {
    mockFindFirst.mockResolvedValue(undefined)

    await expect(
      getReturnEligibility('ORD1234567', 'user-1')
    ).rejects.toBeInstanceOf(ReturnRequestError)
  })

  it('refuses an order that has not been delivered', async () => {
    mockFindFirst.mockResolvedValue(
      orderWithItems({ status: 'SHIPPED', deliveredAt: null })
    )

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.isReturnable).toBe(false)
    expect(result.reason).toBe('NOT_DELIVERED')
  })

  it('refuses once the window has expired', async () => {
    mockFindFirst.mockResolvedValue(
      orderWithItems({ deliveredAt: new Date(Date.now() - 30 * DAY) })
    )

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.isReturnable).toBe(false)
    expect(result.reason).toBe('WINDOW_EXPIRED')
  })

  it('refuses when every item belongs to an excluded category', async () => {
    mockGetReturnsConfig.mockResolvedValue({
      ...defaultConfig,
      nonReturnableCategoryNames: ['mugs'],
    })
    mockFindFirst.mockResolvedValue(orderWithItems())

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.isReturnable).toBe(false)
    expect(result.reason).toBe('CATEGORY_EXCLUDED')
  })

  it('matches category names case-insensitively', async () => {
    // `products.category` is free text with no foreign key, so nothing
    // constrains its casing.
    mockGetReturnsConfig.mockResolvedValue({
      ...defaultConfig,
      nonReturnableCategoryNames: ['  MUGS  '],
    })
    mockFindFirst.mockResolvedValue(orderWithItems())

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.reason).toBe('CATEGORY_EXCLUDED')
  })

  it('applies a per-category window override', async () => {
    mockGetReturnsConfig.mockResolvedValue({
      ...defaultConfig,
      categoryWindowDays: { Mugs: 30 },
    })
    mockFindFirst.mockResolvedValue(
      orderWithItems({ deliveredAt: new Date(Date.now() - 10 * DAY) })
    )

    // Outside the 7-day default but inside the 30-day override.
    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.isReturnable).toBe(true)
    expect(result.reason).toBeNull()
  })

  it('excludes quantities already held by a live return', async () => {
    mockFindFirst.mockResolvedValue(orderWithItems())
    // First select is the held-quantity join; the second lists the claims.
    mockSelect
      .mockReturnValueOnce(
        selectReturning([{ orderItemId: 'itemAAA', quantity: 2 }])
      )
      .mockReturnValue(selectReturning([]))

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.items[0]).toMatchObject({
      orderedQuantity: 3,
      returnedQuantity: 2,
      returnableQuantity: 1,
    })
  })

  it('reports FULLY_RETURNED once nothing is left', async () => {
    mockFindFirst.mockResolvedValue(orderWithItems())
    mockSelect
      .mockReturnValueOnce(
        selectReturning([{ orderItemId: 'itemAAA', quantity: 3 }])
      )
      .mockReturnValue(selectReturning([]))

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.isReturnable).toBe(false)
    expect(result.reason).toBe('FULLY_RETURNED')
  })

  it('releases quantity held by a rejected return', async () => {
    // The held-quantity query filters `status != REJECTED`, so a rejected
    // claim contributes nothing and its units become requestable again.
    mockFindFirst.mockResolvedValue(orderWithItems())
    mockSelect.mockReturnValue(selectReturning([]))

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.items[0].returnableQuantity).toBe(3)
    expect(result.isReturnable).toBe(true)
  })

  it('surfaces existing claims newest first', async () => {
    mockFindFirst.mockResolvedValue(orderWithItems())
    mockSelect.mockReturnValueOnce(selectReturning([])).mockReturnValue(
      selectReturning([
        {
          id: 'RET0001',
          status: 'REQUESTED',
          reason: 'DAMAGED',
          decisionReason: null,
          refundAmount: 100,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'RET0002',
          status: 'REJECTED',
          reason: 'DEFECTIVE',
          decisionReason: 'Outside window',
          refundAmount: 0,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      ])
    )

    const result = await getReturnEligibility('ORD1234567', 'user-1')

    expect(result.returns.map((claim) => claim.id)).toEqual([
      'RET0002',
      'RET0001',
    ])
    expect(result.returns[0].createdAt).toBe('2026-02-01T00:00:00.000Z')
  })
})

describe('createReturnRequest', () => {
  const input = {
    reason: 'DAMAGED' as const,
    items: [{ orderItemId: 'itemAAA', quantity: 1 }],
    evidenceIds: ['evidAAA'],
  }

  it('rejects an order owned by someone else as missing', async () => {
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          select: () =>
            selectReturning([
              { id: 'ORD1234567', userId: 'other-user', status: 'DELIVERED' },
            ]),
        })
    )

    await expect(
      createReturnRequest('ORD1234567', 'user-1', input)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rejects an order that is not delivered', async () => {
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          select: () =>
            selectReturning([
              {
                id: 'ORD1234567',
                userId: 'user-1',
                status: 'PROCESSING',
                deliveredAt: null,
              },
            ]),
        })
    )

    await expect(
      createReturnRequest('ORD1234567', 'user-1', input)
    ).rejects.toMatchObject({ status: 409, code: 'NOT_DELIVERED' })
  })
})
