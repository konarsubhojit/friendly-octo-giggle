import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockProductsFindMany,
  mockProductVariationsFindMany,
  mockWishlistsFindMany,
  mockWishlistsFindFirst,
  mockWishlistsInsertReturning,
  mockWishlistsInsertValues,
  mockWishlistsDeleteReturning,
  mockWishlistsDeleteWhere,
  mockSelectWhere,
  mockSelectFrom,
  mockSelect,
  mockInsert,
  mockDelete,
  mockInvalidateProductCaches,
  mockCacheShareResolve,
  mockWithReplicas,
} = vi.hoisted(() => {
  // Wishlists insert chain: .values().onConflictDoNothing().returning()
  const mockWishlistsInsertReturning = vi.fn()
  const _mockWishlistsOnConflictDoNothing = vi.fn(() => ({
    returning: mockWishlistsInsertReturning,
  }))
  const mockWishlistsInsertValues = vi.fn(() => ({
    onConflictDoNothing: _mockWishlistsOnConflictDoNothing,
    returning: mockWishlistsInsertReturning,
  }))

  // Wishlists delete chain: .where().returning()
  const mockWishlistsDeleteReturning = vi.fn()
  const mockWishlistsDeleteWhere = vi.fn(() => ({
    returning: mockWishlistsDeleteReturning,
  }))

  // Shared insert mock (routes based on call order)
  const mockInsert = vi.fn()

  // Delete mock
  const mockDelete = vi.fn(() => ({ where: mockWishlistsDeleteWhere }))

  // Select chain for simple queries
  const mockSelectWhere = vi.fn()
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }))
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }))

  return {
    mockProductsFindMany: vi.fn(),
    mockProductVariationsFindMany: vi.fn(),
    mockWishlistsFindMany: vi.fn(),
    mockWishlistsFindFirst: vi.fn(),
    mockWishlistsInsertReturning,
    mockWishlistsInsertValues,
    mockWishlistsDeleteReturning,
    mockWishlistsDeleteWhere,
    mockSelectWhere,
    mockSelectFrom,
    mockSelect,
    mockInsert,
    mockDelete,
    mockInvalidateProductCaches: vi.fn(),
    mockCacheShareResolve: vi.fn(),
    mockWithReplicas: vi.fn((primary) => primary),
  }
})

vi.mock('@neondatabase/serverless', () => ({
  Pool: vi.fn(),
}))

vi.mock('drizzle-orm/neon-serverless', () => ({
  drizzle: vi.fn(() => ({
    query: {
      products: {
        findMany: mockProductsFindMany,
      },
      productVariations: {
        findMany: mockProductVariationsFindMany,
      },
      wishlists: {
        findMany: mockWishlistsFindMany,
        findFirst: mockWishlistsFindFirst,
      },
      productShares: {
        findFirst: vi.fn(),
      },
    },
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
    })),
  })),
}))

vi.mock('@/lib/schema', () => ({
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
  orderItems: { productId: 'productId', quantity: 'quantity' },
  orders: { id: 'id', status: 'status' },
  passwordHistory: {},
  productShares: { key: 'key', productId: 'productId', variationId: 'variationId' },
  productVariations: {},
  products: {
    id: 'id',
    name: 'name',
    description: 'description',
    price: 'price',
    image: 'image',
    images: 'images',
    stock: 'stock',
    category: 'category',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  reviews: {},
  sessions: {},
  users: {},
  verificationTokens: {},
  wishlists: {
    id: 'id',
    userId: 'userId',
    productId: 'productId',
  },
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

vi.mock('@/lib/env', () => ({
  env: {
    DATABASE_URL: 'postgres://fake:fake@localhost:5432/fakedb',
    READ_DATABASE_URL: 'postgres://fake:fake@localhost:5432/read',
    NODE_ENV: 'test',
  },
}))

vi.mock('@/lib/cache', () => ({
  cacheProductsList: vi.fn(async (fetcher: () => Promise<unknown>) => fetcher()),
  cacheProductById: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
  invalidateProductCaches: mockInvalidateProductCaches,
  cacheShareResolve: mockCacheShareResolve,
  CACHE_KEYS: { PRODUCTS_ALL: 'products:all' },
  CACHE_TTL: { PRODUCTS_LIST: 60, STALE_TIME: 10 },
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
    fetcher()
  ),
}))

vi.mock('@/lib/serializers', () => ({
  serializeProduct: vi.fn((p) => ({
    ...p,
    createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
    updatedAt: p.updatedAt?.toISOString?.() ?? p.updatedAt,
    deletedAt: p.deletedAt?.toISOString?.() ?? null,
  })),
  serializeVariation: vi.fn((v) => ({
    ...v,
    image: v.image ?? null,
    images: v.images ?? [],
    createdAt: v.createdAt?.toISOString?.() ?? v.createdAt,
    updatedAt: v.updatedAt?.toISOString?.() ?? v.updatedAt,
    deletedAt: null,
  })),
}))

vi.mock('drizzle-orm', () => {
  const sqlMock = vi.fn((parts: TemplateStringsArray, ...values: unknown[]) => {
    const result = { op: 'sql', parts, values, as: vi.fn((alias: string) => ({ op: 'sql_alias', alias })) }
    return result
  })
  ;(sqlMock as unknown as Record<string, unknown>).raw = vi.fn((s: string) => ({ op: 'sql_raw', s }))
  return {
    eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
    desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    ilike: vi.fn((...args: unknown[]) => ({ op: 'ilike', args })),
    or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
    ne: vi.fn((...args: unknown[]) => ({ op: 'ne', args })),
    inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
    sql: sqlMock,
  }
})

vi.mock('drizzle-orm/pg-core', () => ({
  withReplicas: mockWithReplicas,
}))

import { db } from '@/lib/db'

const now = new Date('2025-03-01T10:00:00.000Z')

function makeProductRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod001',
    name: 'Rose Bouquet',
    description: 'Beautiful roses',
    price: 500,
    image: 'https://example.com/rose.jpg',
    images: [],
    stock: 10,
    category: 'Flowers',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeVariationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'var0001',
    productId: 'prod001',
    name: 'Red',
    designName: 'Classic',
    image: null,
    images: [],
    price: 600,
    variationType: 'colour' as const,
    stock: 5,
    styleId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('db.products.findBestsellers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns products sorted by sales with their variations', async () => {
    const productRows = [makeProductRow({ id: 'prod001' }), makeProductRow({ id: 'prod002' })]
    const variationRows = [makeVariationRow({ productId: 'prod001' })]

    // findBestsellers calls drizzleDb.select() twice (subquery + main)
    // and drizzleDb.query.productVariations.findMany() once
    const subqueryChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      as: vi.fn().mockReturnValue({ _alias: 'sales' }),
    }
    const mainQueryChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      $dynamic: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(productRows),
    }

    mockSelect
      .mockReturnValueOnce(subqueryChain)
      .mockReturnValueOnce(mainQueryChain)

    mockProductVariationsFindMany.mockResolvedValue(variationRows)

    const results = await db.products.findBestsellers({ limit: 5 })

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('prod001')
    expect(results[0].variations).toHaveLength(1)
    expect(results[1].variations).toHaveLength(0)
  })

  it('returns empty array when no bestsellers found', async () => {
    const subqueryChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      as: vi.fn().mockReturnValue({}),
    }
    const mainQueryChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      $dynamic: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }

    mockSelect
      .mockReturnValueOnce(subqueryChain)
      .mockReturnValueOnce(mainQueryChain)

    const results = await db.products.findBestsellers({ limit: 5 })

    expect(results).toEqual([])
    // productVariations.findMany should not be called when no products found
    expect(mockProductVariationsFindMany).not.toHaveBeenCalled()
  })

  it('groups variations by productId correctly', async () => {
    const productRows = [makeProductRow({ id: 'prodA' }), makeProductRow({ id: 'prodB' })]
    const variationRows = [
      makeVariationRow({ id: 'v1', productId: 'prodA' }),
      makeVariationRow({ id: 'v2', productId: 'prodA' }),
      makeVariationRow({ id: 'v3', productId: 'prodB' }),
    ]

    const subqueryChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      as: vi.fn().mockReturnValue({}),
    }
    const mainQueryChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      $dynamic: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(productRows),
    }

    mockSelect
      .mockReturnValueOnce(subqueryChain)
      .mockReturnValueOnce(mainQueryChain)
    mockProductVariationsFindMany.mockResolvedValue(variationRows)

    const results = await db.products.findBestsellers({ limit: 2 })

    expect(results[0].variations).toHaveLength(2)
    expect(results[1].variations).toHaveLength(1)
  })
})

describe('db.products.findMinimalByIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns minimal products for given IDs', async () => {
    const minimalProducts = [
      { id: 'prod001', name: 'Rose', description: 'Roses', price: 500, stock: 10, category: 'Flowers', image: 'rose.jpg' },
      { id: 'prod002', name: 'Lily', description: 'Lilies', price: 300, stock: 5, category: 'Flowers', image: 'lily.jpg' },
    ]
    mockProductsFindMany.mockResolvedValue(minimalProducts)

    const results = await db.products.findMinimalByIds(['prod001', 'prod002'])

    expect(results).toHaveLength(2)
    expect(mockProductsFindMany).toHaveBeenCalledOnce()
  })

  it('returns empty array for empty IDs list without querying DB', async () => {
    const results = await db.products.findMinimalByIds([])

    expect(results).toEqual([])
    expect(mockProductsFindMany).not.toHaveBeenCalled()
  })

  it('filters by category when provided', async () => {
    mockProductsFindMany.mockResolvedValue([])

    await db.products.findMinimalByIds(['prod001'], 'Flowers')

    expect(mockProductsFindMany).toHaveBeenCalledOnce()
  })
})

describe('db.wishlists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProductIds', () => {
    it('returns product IDs for a user', async () => {
      mockSelectWhere.mockResolvedValue([
        { productId: 'prod001' },
        { productId: 'prod002' },
      ])
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere })
      mockSelect.mockReturnValue({ from: mockSelectFrom })

      const ids = await db.wishlists.getProductIds('user123')

      expect(ids).toEqual(['prod001', 'prod002'])
      expect(mockSelect).toHaveBeenCalledOnce()
    })

    it('returns empty array when user has no wishlist items', async () => {
      mockSelectWhere.mockResolvedValue([])
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere })
      mockSelect.mockReturnValue({ from: mockSelectFrom })

      const ids = await db.wishlists.getProductIds('user999')

      expect(ids).toEqual([])
    })
  })

  describe('getProducts', () => {
    it('returns full product objects for wishlist items', async () => {
      const wishlistRows = [
        {
          userId: 'user123',
          productId: 'prod001',
          product: {
            ...makeProductRow({ id: 'prod001' }),
            variations: [makeVariationRow()],
          },
        },
      ]
      mockWishlistsFindMany.mockResolvedValue(wishlistRows)

      const products = await db.wishlists.getProducts('user123')

      expect(products).toHaveLength(1)
      expect(products[0].id).toBe('prod001')
      expect(products[0].variations).toHaveLength(1)
    })

    it('filters out deleted products from wishlist', async () => {
      const wishlistRows = [
        {
          userId: 'user123',
          productId: 'prod001',
          product: {
            ...makeProductRow({ id: 'prod001', deletedAt: now }),
            variations: [],
          },
        },
        {
          userId: 'user123',
          productId: 'prod002',
          product: {
            ...makeProductRow({ id: 'prod002' }),
            variations: [],
          },
        },
      ]
      mockWishlistsFindMany.mockResolvedValue(wishlistRows)

      const products = await db.wishlists.getProducts('user123')

      expect(products).toHaveLength(1)
      expect(products[0].id).toBe('prod002')
    })

    it('filters out null products from wishlist', async () => {
      const wishlistRows = [
        { userId: 'user123', productId: 'prod001', product: null },
      ]
      mockWishlistsFindMany.mockResolvedValue(wishlistRows)

      const products = await db.wishlists.getProducts('user123')

      expect(products).toHaveLength(0)
    })
  })

  describe('add', () => {
    it('adds product to wishlist and returns the row', async () => {
      mockWishlistsInsertReturning.mockResolvedValue([
        { userId: 'user123', productId: 'prod001' },
      ])
      mockInsert.mockReturnValue({ values: mockWishlistsInsertValues })

      const result = await db.wishlists.add('user123', 'prod001')

      expect(result).toEqual({ userId: 'user123', productId: 'prod001' })
    })

    it('returns fallback when onConflictDoNothing returns empty (already in wishlist)', async () => {
      mockWishlistsInsertReturning.mockResolvedValue([])
      mockInsert.mockReturnValue({ values: mockWishlistsInsertValues })

      const result = await db.wishlists.add('user123', 'prod001')

      // Fallback returns the userId/productId pair
      expect(result).toEqual({ userId: 'user123', productId: 'prod001' })
    })
  })

  describe('remove', () => {
    it('removes product from wishlist and returns true', async () => {
      mockWishlistsDeleteReturning.mockResolvedValue([{ id: 'wl001' }])
      mockDelete.mockReturnValue({ where: mockWishlistsDeleteWhere })

      const result = await db.wishlists.remove('user123', 'prod001')

      expect(result).toBe(true)
    })

    it('returns false when product not in wishlist', async () => {
      mockWishlistsDeleteReturning.mockResolvedValue([])
      mockDelete.mockReturnValue({ where: mockWishlistsDeleteWhere })

      const result = await db.wishlists.remove('user123', 'prod999')

      expect(result).toBe(false)
    })
  })

  describe('has', () => {
    it('returns true when product is in wishlist', async () => {
      mockWishlistsFindFirst.mockResolvedValue({ id: 'wl001' })

      const result = await db.wishlists.has('user123', 'prod001')

      expect(result).toBe(true)
    })

    it('returns false when product is not in wishlist', async () => {
      mockWishlistsFindFirst.mockResolvedValue(undefined)

      const result = await db.wishlists.has('user123', 'prod999')

      expect(result).toBe(false)
    })
  })
})
