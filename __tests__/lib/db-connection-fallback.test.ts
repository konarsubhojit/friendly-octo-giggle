import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests that the database connection falls back to DATABASE_URL for the read
 * pool when READ_DATABASE_URL is not set, and uses READ_DATABASE_URL when it
 * is provided. This verifies the `env.READ_DATABASE_URL ?? env.DATABASE_URL`
 * fallback in lib/db.ts.
 */

const makePoolMock = () => vi.fn()

const makeOtherMocks = (PoolMock: ReturnType<typeof makePoolMock>) => {
  const drizzleMock = vi.fn(() => ({
    query: {
      products: { findMany: vi.fn(), findFirst: vi.fn() },
      productShares: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  }))

  vi.doMock('@neondatabase/serverless', () => ({ Pool: PoolMock }))
  vi.doMock('drizzle-orm/neon-serverless', () => ({ drizzle: drizzleMock }))
  vi.doMock('drizzle-orm/pg-core', () => ({
    withReplicas: vi.fn((primary: unknown) => primary),
  }))
  vi.doMock('@/lib/schema', () => ({
    checkoutRequestStatusEnum: {},
    emailTypeEnum: {},
    failedEmailStatusEnum: {},
    orderStatusEnum: {},
    userRoleEnum: {},
    accounts: {},
    cartItems: {},
    carts: {},
    categories: {},
    checkoutRequests: {},
    failedEmails: {},
    orderItems: {},
    orders: {},
    passwordHistory: {},
    productShares: {},
    productVariations: {},
    products: {},
    reviews: {},
    sessions: {},
    users: {},
    verificationTokens: {},
    wishlists: {},
    accountsRelations: {},
    cartsRelations: {},
    cartItemsRelations: {},
    categoriesRelations: {},
    checkoutRequestsRelations: {},
    orderItemsRelations: {},
    ordersRelations: {},
    passwordHistoryRelations: {},
    productSharesRelations: {},
    productVariationsRelations: {},
    productsRelations: {},
    reviewsRelations: {},
    sessionsRelations: {},
    usersRelations: {},
    wishlistsRelations: {},
  }))
  vi.doMock('@/lib/cache', () => ({
    cacheProductsList: vi.fn(),
    cacheProductById: vi.fn(),
    invalidateProductCaches: vi.fn(),
    cacheShareResolve: vi.fn(),
    CACHE_KEYS: { PRODUCTS_ALL: 'products:all' },
    CACHE_TTL: { PRODUCTS_LIST: 60, STALE_TIME: 10 },
  }))
  vi.doMock('@/lib/redis', () => ({
    getCachedData: vi.fn((_, __, fetcher: () => unknown) => fetcher()),
  }))
  vi.doMock('@/lib/serializers', () => ({
    serializeProduct: vi.fn((p: Record<string, unknown>) => p),
    serializeVariation: vi.fn((v: Record<string, unknown>) => v),
  }))
  vi.doMock('drizzle-orm', () => ({
    eq: vi.fn(),
    desc: vi.fn(),
    and: vi.fn(),
    isNull: vi.fn(),
    ilike: vi.fn(),
    or: vi.fn(),
    ne: vi.fn(),
    inArray: vi.fn(),
    sql: vi.fn(),
  }))

  return drizzleMock
}

/** Clear the global pool singletons so lib/db.ts recreates them on next import */
const clearGlobalPools = () => {
  const g = globalThis as Record<string, unknown>
  delete g.writePool
  delete g.readPool
}

describe('db connection fallback (READ_DATABASE_URL not set)', () => {
  beforeEach(() => {
    vi.resetModules()
    clearGlobalPools()
  })

  afterEach(() => {
    vi.resetModules()
    clearGlobalPools()
  })

  it('uses DATABASE_URL for both write and read pools when READ_DATABASE_URL is absent', async () => {
    const PoolMock = makePoolMock()
    makeOtherMocks(PoolMock)

    vi.doMock('@/lib/env', () => ({
      env: {
        DATABASE_URL: 'postgres://write:pass@primary:5432/db',
        // READ_DATABASE_URL is intentionally not set
        NODE_ENV: 'test',
      },
    }))

    await import('@/lib/db')

    expect(PoolMock).toHaveBeenCalledTimes(2)
    const connectionStrings = PoolMock.mock.calls.map(
      (call: unknown[]) =>
        (call[0] as { connectionString: string }).connectionString
    )
    // Both pools should fall back to DATABASE_URL
    expect(connectionStrings[0]).toBe('postgres://write:pass@primary:5432/db')
    expect(connectionStrings[1]).toBe('postgres://write:pass@primary:5432/db')
  })

  it('uses READ_DATABASE_URL for the read pool when it is set', async () => {
    const PoolMock = makePoolMock()
    makeOtherMocks(PoolMock)

    vi.doMock('@/lib/env', () => ({
      env: {
        DATABASE_URL: 'postgres://write:pass@primary:5432/db',
        READ_DATABASE_URL: 'postgres://read:pass@replica:5432/db',
        NODE_ENV: 'test',
      },
    }))

    await import('@/lib/db')

    expect(PoolMock).toHaveBeenCalledTimes(2)
    const connectionStrings = PoolMock.mock.calls.map(
      (call: unknown[]) =>
        (call[0] as { connectionString: string }).connectionString
    )
    // Write pool uses DATABASE_URL, read pool uses READ_DATABASE_URL
    expect(connectionStrings[0]).toBe('postgres://write:pass@primary:5432/db')
    expect(connectionStrings[1]).toBe('postgres://read:pass@replica:5432/db')
  })
})
