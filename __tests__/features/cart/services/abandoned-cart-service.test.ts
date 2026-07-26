import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks (referenced in vi.mock factories) ─────

const mockSelect = vi.hoisted(() => vi.fn())
const mockDrizzleQuery = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
}))
const mockPrimaryInsert = vi.hoisted(() => vi.fn())

// ─── Mock database ────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: mockSelect,
    query: mockDrizzleQuery,
  },
  primaryDrizzleDb: {
    insert: mockPrimaryInsert,
  },
}))

// ─── Mock email ───────────────────────────────────────────

const mockSendAbandonedCartReminderEmail = vi.hoisted(() => vi.fn())

vi.mock('@/lib/email', () => ({
  sendAbandonedCartReminderEmail: mockSendAbandonedCartReminderEmail,
}))

// ─── Mock logger ──────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

// ─── Mock env ─────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_APP_URL: 'https://example.com' },
}))

// ─── Mock schema ──────────────────────────────────────────

vi.mock('@/lib/schema', () => ({
  carts: { id: {}, userId: {}, updatedAt: {} },
  cartItems: { cartId: {}, productId: {}, variantId: {}, quantity: {} },
  users: { id: {}, email: {}, name: {}, currencyPreference: {} },
  notificationPreferences: { userId: {}, marketingEmail: {} },
  abandonedCartReminders: { id: {}, cartId: {}, userId: {}, reminderNumber: {} },
  productVariants: { id: {}, price: {} },
  products: { id: {}, name: {} },
}))

// ─── Mock drizzle-orm ─────────────────────────────────────

// Use plain functions (not vi.fn) in the factory so they are safe to call at
// hoist time. The sql tagged-template must return an object with .as() because
// the service calls sql`...`.as('alias').
vi.mock('drizzle-orm', () => {
  const colAlias = { col: 'alias' }
  function sqlTag() {
    return { as: () => colAlias }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(sqlTag as any).raw = () => ({ raw: true })
  return {
    eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
    and: (...args: unknown[]) => ({ and: args }),
    lt: (a: unknown, b: unknown) => ({ lt: [a, b] }),
    isNotNull: (a: unknown) => ({ isNotNull: a }),
    inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
    count: () => ({ count: true, as: () => colAlias }),
    sql: sqlTag,
  }
})

// ─── Mock currency ────────────────────────────────────────

vi.mock('@/lib/currency', () => ({
  formatPriceForCurrency: vi.fn((_price: number, _code: string) => '₹499.00'),
  isValidCurrencyCode: vi.fn((code: string) => ['INR', 'USD', 'EUR', 'GBP'].includes(code)),
}))

// ─── Chainable Drizzle select builder ─────────────────────

/**
 * Returns a value-returning mock for the final method in Drizzle's fluent
 * select chain.  All other method calls (from, innerJoin, leftJoin, where,
 * groupBy, having) return `this`.
 */
const makeSelectChain = (returnValue: unknown[]) => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  }
  return chain
}

const makeItemsSelectChain = (returnValue: unknown[]) => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  }
  return chain
}

import { processAbandonedCartReminders } from '@/features/cart/services/abandoned-cart-service'

describe('processAbandonedCartReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero counts when no idle carts exist', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))

    const result = await processAbandonedCartReminders()

    expect(result.firstReminders).toBe(0)
    expect(result.secondReminders).toBe(0)
    expect(result.errors).toBe(0)
    expect(result.results).toHaveLength(0)
  })

  it('sends first reminder for a newly abandoned cart', async () => {
    mockSelect
      .mockReturnValueOnce(
        makeSelectChain([
          { cartId: 'cart001', userId: 'user001', reminderCount: 0 },
        ])
      )
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(
        makeItemsSelectChain([
          { productName: 'Test Product', quantity: 2, price: 499, variantId: 'var001' },
        ])
      )

    mockDrizzleQuery.users.findFirst.mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User',
      currencyPreference: 'INR',
    })

    mockPrimaryInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    })

    const result = await processAbandonedCartReminders()

    expect(mockSendAbandonedCartReminderEmail).toHaveBeenCalledOnce()
    expect(mockSendAbandonedCartReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        reminderNumber: 1,
        cartId: 'cart001',
      })
    )
    expect(result.firstReminders).toBe(1)
    expect(result.secondReminders).toBe(0)
  })

  it('sends second reminder for a cart that already received reminder #1', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(
        makeSelectChain([
          { cartId: 'cart002', userId: 'user002', reminderCount: 1 },
        ])
      )
      .mockReturnValueOnce(
        makeItemsSelectChain([
          { productName: 'Another Product', quantity: 1, price: 299, variantId: 'var002' },
        ])
      )

    mockDrizzleQuery.users.findFirst.mockResolvedValue({
      email: 'user2@example.com',
      name: 'User Two',
      currencyPreference: 'INR',
    })

    mockPrimaryInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    })

    const result = await processAbandonedCartReminders()

    expect(mockSendAbandonedCartReminderEmail).toHaveBeenCalledOnce()
    expect(mockSendAbandonedCartReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user2@example.com',
        reminderNumber: 2,
        cartId: 'cart002',
      })
    )
    expect(result.secondReminders).toBe(1)
  })

  it('skips a cart when the user is not found', async () => {
    mockSelect
      .mockReturnValueOnce(
        makeSelectChain([
          { cartId: 'cart003', userId: 'user003', reminderCount: 0 },
        ])
      )
      .mockReturnValueOnce(makeSelectChain([]))

    mockDrizzleQuery.users.findFirst.mockResolvedValue(null)

    const result = await processAbandonedCartReminders()

    expect(mockSendAbandonedCartReminderEmail).not.toHaveBeenCalled()
    expect(result.firstReminders).toBe(0)
    expect(result.errors).toBe(1)
  })

  it('skips a cart when it has no items', async () => {
    mockSelect
      .mockReturnValueOnce(
        makeSelectChain([
          { cartId: 'cart004', userId: 'user004', reminderCount: 0 },
        ])
      )
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeItemsSelectChain([]))

    mockDrizzleQuery.users.findFirst.mockResolvedValue({
      email: 'user4@example.com',
      name: 'User Four',
      currencyPreference: 'INR',
    })

    const result = await processAbandonedCartReminders()

    expect(mockSendAbandonedCartReminderEmail).not.toHaveBeenCalled()
    expect(result.firstReminders).toBe(0)
    expect(result.errors).toBe(1)
  })

  it('does not send second reminder for a cart in the first-reminder set', async () => {
    const sharedCartId = 'cart005'
    const sharedUserId = 'user005'

    mockSelect
      .mockReturnValueOnce(
        makeSelectChain([
          { cartId: sharedCartId, userId: sharedUserId, reminderCount: 0 },
        ])
      )
      .mockReturnValueOnce(
        makeSelectChain([
          { cartId: sharedCartId, userId: sharedUserId, reminderCount: 0 },
        ])
      )
      .mockReturnValueOnce(
        makeItemsSelectChain([
          { productName: 'Shared Product', quantity: 1, price: 199, variantId: 'var005' },
        ])
      )

    mockDrizzleQuery.users.findFirst.mockResolvedValue({
      email: 'user5@example.com',
      name: 'User Five',
      currencyPreference: 'INR',
    })

    mockPrimaryInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    })

    const result = await processAbandonedCartReminders()

    expect(mockSendAbandonedCartReminderEmail).toHaveBeenCalledOnce()
    expect(result.firstReminders).toBe(1)
    expect(result.secondReminders).toBe(0)
  })

  it('uses email as name when user has no name', async () => {
    mockSelect
      .mockReturnValueOnce(
        makeSelectChain([
          { cartId: 'cart006', userId: 'user006', reminderCount: 0 },
        ])
      )
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(
        makeItemsSelectChain([
          { productName: 'Product', quantity: 1, price: 100, variantId: 'var006' },
        ])
      )

    mockDrizzleQuery.users.findFirst.mockResolvedValue({
      email: 'user6@example.com',
      name: null,
      currencyPreference: null,
    })

    mockPrimaryInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    })

    const result = await processAbandonedCartReminders()

    expect(result.firstReminders).toBe(1)
    expect(mockSendAbandonedCartReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: 'user6@example.com',
        cartUrl: 'https://example.com/cart',
      })
    )
  })
})
