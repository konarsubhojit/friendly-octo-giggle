import { describe, it, expect, vi, beforeEach } from 'vitest'
const {
  mockFindMany,
  mockFindFirst,
  mockSharesFindFirst,
  mockReturningInsert,
  mockValues,
  mockInsert,
  mockReturningUpdate,
  mockSet,
  mockUpdate,
  mockCacheProductsList,
  mockCacheProductById,
  mockInvalidateProductCaches,
  mockCacheShareResolve,
  mockGetCachedData,
  mockWithReplicas,
} = vi.hoisted(() => {
  const mockReturningInsert = vi.fn()
  const mockValues = vi.fn(() => ({ returning: mockReturningInsert }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))

  const mockReturningUpdate = vi.fn()
  const mockWhere = vi.fn(() => ({ returning: mockReturningUpdate }))
  const mockSet = vi.fn(() => ({ where: mockWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))

  return {
    mockFindMany: vi.fn(),
    mockFindFirst: vi.fn(),
    mockSharesFindFirst: vi.fn(),
    mockReturningInsert,
    mockValues,
    mockInsert,
    mockReturningUpdate,
    mockSet,
    mockUpdate,
    mockCacheProductsList: vi.fn(),
    mockCacheProductById: vi.fn(),
    mockInvalidateProductCaches: vi.fn(),
    mockCacheShareResolve: vi.fn(),
    mockGetCachedData: vi.fn((key, ttl, fetcher) => fetcher()),
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
        findMany: mockFindMany,
        findFirst: mockFindFirst,
      },
      productShares: {
        findFirst: mockSharesFindFirst,
      },
    },
    insert: mockInsert,
    update: mockUpdate,
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
  orderItems: {},
  orders: {},
  passwordHistory: {},
  productShares: {},
  productVariants: {},
  productOptions: {},
  productOptionValues: {},
  productVariantOptionValues: {},
  products: { id: 'id', deletedAt: 'deletedAt' },
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
  productVariantsRelations: {},
  productOptionsRelations: {},
  productOptionValuesRelations: {},
  productVariantOptionValuesRelations: {},
  productsRelations: {},
  reviewsRelations: {},
  sessionsRelations: {},
  usersRelations: {},
  wishlistsRelations: {},
}))

vi.mock('@/lib/env', () => ({
  env: {
    DATABASE_URL: 'postgres://fake:fake@localhost:5432/fakedb',
    READ_DATABASE_URL: 'postgres://fake:fake@localhost:5432/read-replica',
    NODE_ENV: 'test',
  },
}))

vi.mock('@/lib/cache', () => ({
  cacheProductsList: mockCacheProductsList,
  cacheProductById: mockCacheProductById,
  invalidateProductCaches: mockInvalidateProductCaches,
  cacheShareResolve: mockCacheShareResolve,
  CACHE_KEYS: {
    PRODUCTS_ALL: 'products:all',
  },
  CACHE_TTL: {
    PRODUCTS_LIST: 60,
    STALE_TIME: 10,
  },
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: mockGetCachedData,
}))

vi.mock('@/lib/serializers', () => ({
  serializeProduct: vi.fn((p) => ({
    ...p,
    createdAt: p.createdAt?.toISOString?.() || p.createdAt,
    updatedAt: p.updatedAt?.toISOString?.() || p.updatedAt,
    deletedAt: p.deletedAt?.toISOString?.() || p.deletedAt || null,
  })),
  serializeVariant: vi.fn((v) => ({
    ...v,
    sku: v.sku ?? null,
    image: v.image ?? null,
    images: v.images ?? [],
    createdAt: v.createdAt?.toISOString?.() || v.createdAt,
    updatedAt: v.updatedAt?.toISOString?.() || v.updatedAt,
    deletedAt: v.deletedAt?.toISOString?.() || v.deletedAt || null,
  })),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
  ilike: vi.fn((...args: unknown[]) => ({ op: 'ilike', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
}))

vi.mock('drizzle-orm/pg-core', () => ({
  withReplicas: mockWithReplicas,
}))
import { db } from '@/lib/db'
const now = new Date('2025-01-15T10:00:00.000Z')

function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abc1234',
    name: 'Test Product',
    description: 'A test product',
    image: 'https://example.com/img.jpg',
    category: 'Electronics',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    options: [],
    variants: [
      {
        id: 'var0001',
        productId: 'abc1234',
        sku: null,
        image: null,
        images: [],
        price: 150,
        stock: 3,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        optionValues: [],
      },
    ],
    ...overrides,
  }
}

function expectedSerialized(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abc1234',
    name: 'Test Product',
    description: 'A test product',
    image: 'https://example.com/img.jpg',
    category: 'Electronics',
    deletedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    options: [],
    variants: [
      {
        id: 'var0001',
        productId: 'abc1234',
        sku: null,
        image: null,
        images: [],
        price: 150,
        stock: 3,
        deletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        optionValues: [],
      },
    ],
    ...overrides,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  mockInvalidateProductCaches.mockResolvedValue(undefined)
})

describe('db.products', () => {
  describe('findAll', () => {
    it('returns serialized products without caching', async () => {
      mockFindMany.mockResolvedValue([makeDbRow()])

      const result = await db.products.findAll()

      expect(result).toEqual([expectedSerialized()])
      expect(mockFindMany).toHaveBeenCalledOnce()
      expect(mockCacheProductsList).not.toHaveBeenCalled()
    })

    it('respects pagination parameters', async () => {
      mockFindMany.mockResolvedValue([makeDbRow()])

      const result = await db.products.findAll({
        limit: 10,
        offset: 0,
      })

      expect(result).toEqual([expectedSerialized()])
      expect(mockCacheProductsList).not.toHaveBeenCalled()
    })

    it('returns empty array when no products found', async () => {
      mockFindMany.mockResolvedValue([])

      const result = await db.products.findAll()

      expect(result).toEqual([])
    })
  })
  describe('findAllMinimal', () => {
    const minimalRow = {
      id: 'abc1234',
      name: 'Test Product',
      description: 'A test product',
      category: 'Electronics',
      image: 'https://example.com/img.jpg',
      variants: [{ price: 100, stock: 5 }],
    }

    const expectedResult = {
      id: 'abc1234',
      name: 'Test Product',
      description: 'A test product',
      category: 'Electronics',
      image: 'https://example.com/img.jpg',
      price: 100,
      stock: 5,
    }

    it('returns minimal products with derived price and stock', async () => {
      mockFindMany.mockResolvedValue([minimalRow])

      const result = await db.products.findAllMinimal()

      expect(result).toEqual([expectedResult])
      expect(mockCacheProductsList).not.toHaveBeenCalled()
    })

    it('fetches minimal products without caching', async () => {
      mockFindMany.mockResolvedValue([minimalRow])

      const result = await db.products.findAllMinimal()

      expect(result).toEqual([expectedResult])
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('respects limit parameter', async () => {
      mockFindMany.mockResolvedValue([minimalRow])

      const result = await db.products.findAllMinimal({ limit: 5 })

      expect(result).toEqual([expectedResult])
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('respects search and category filters', async () => {
      mockFindMany.mockResolvedValue([minimalRow])

      const result = await db.products.findAllMinimal({
        search: 'test',
        category: 'Electronics',
      })

      expect(result).toEqual([expectedResult])
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })
  })
  describe('findById', () => {
    it('returns serialized product without cache', async () => {
      mockFindFirst.mockResolvedValue(makeDbRow())

      const result = await db.products.findById('abc1234', false)

      expect(result).toEqual(expectedSerialized())
      expect(mockFindFirst).toHaveBeenCalledOnce()
      expect(mockCacheProductById).not.toHaveBeenCalled()
    })

    it('uses cache by default', async () => {
      mockCacheProductById.mockImplementation(
        (_id: string, fn: () => Promise<unknown>) => fn()
      )
      mockFindFirst.mockResolvedValue(makeDbRow())

      const result = await db.products.findById('abc1234')

      expect(result).toEqual(expectedSerialized())
      expect(mockCacheProductById).toHaveBeenCalledWith(
        'abc1234',
        expect.any(Function)
      )
    })

    it('returns null when product not found', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await db.products.findById('missing1')

      expect(result).toBeNull()
    })
  })
  describe('create', () => {
    it('inserts a product and invalidates caches', async () => {
      const input = {
        name: 'New Product',
        description: 'Brand new',
        image: 'https://example.com/new.jpg',
        category: 'Apparel',
      }

      const dbRow = {
        id: 'new1234',
        ...input,
        images: [],
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }

      mockReturningInsert.mockResolvedValue([dbRow])

      const result = await db.products.create(input)

      expect(mockInsert).toHaveBeenCalledOnce()
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          ...input,
          updatedAt: expect.any(Date),
        })
      )
      expect(result).toEqual({
        ...input,
        id: 'new1234',
        images: [],
        deletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      expect(mockInvalidateProductCaches).toHaveBeenCalledWith()
    })
  })
  describe('update', () => {
    it('updates a product and invalidates caches', async () => {
      const input = { name: 'Updated Name' }
      const dbRow = {
        id: 'abc1234',
        name: 'Updated Name',
        description: 'A test product',
        image: 'https://example.com/img.jpg',
        images: [],
        category: 'Electronics',
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }

      mockReturningUpdate.mockResolvedValue([dbRow])

      const result = await db.products.update('abc1234', input)

      expect(mockUpdate).toHaveBeenCalledOnce()
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ...input,
          updatedAt: expect.any(Date),
        })
      )
      expect(result).toEqual({
        id: 'abc1234',
        name: 'Updated Name',
        description: 'A test product',
        image: 'https://example.com/img.jpg',
        images: [],
        category: 'Electronics',
        deletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      expect(mockInvalidateProductCaches).toHaveBeenCalledWith('abc1234')
    })

    it('returns null when product does not exist', async () => {
      mockReturningUpdate.mockResolvedValue([undefined])

      const result = await db.products.update('missing1', { name: 'Nope' })

      expect(result).toBeNull()
    })
  })
  describe('delete', () => {
    it('soft-deletes a product and invalidates caches', async () => {
      mockReturningUpdate.mockResolvedValue([{ id: 'abc1234' }])

      const result = await db.products.delete('abc1234')

      expect(result).toBe(true)
      expect(mockUpdate).toHaveBeenCalledOnce()
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      )
      expect(mockInvalidateProductCaches).toHaveBeenCalledWith('abc1234')
    })

    it('returns false and skips cache invalidation when product not found', async () => {
      mockReturningUpdate.mockResolvedValue([])

      const result = await db.products.delete('missing1')

      expect(result).toBe(false)
      expect(mockInvalidateProductCaches).not.toHaveBeenCalled()
    })
  })
})

describe('db.shares', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('inserts a share record and returns the key', async () => {
      mockReturningInsert.mockResolvedValue([{ key: 'shr1234' }])

      const result = await db.shares.create('prd1234', null)

      expect(mockInsert).toHaveBeenCalledOnce()
      expect(mockValues).toHaveBeenCalledWith({
        productId: 'prd1234',
        variantId: null,
      })
      expect(result).toBe('shr1234')
    })

    it('inserts a share record with a variationId', async () => {
      mockReturningInsert.mockResolvedValue([{ key: 'shr5678' }])

      const result = await db.shares.create('prd1234', 'var5678')

      expect(mockValues).toHaveBeenCalledWith({
        productId: 'prd1234',
        variantId: 'var5678',
      })
      expect(result).toBe('shr5678')
    })
  })

  describe('resolve', () => {
    it('calls cacheShareResolve with the correct key and returns the result', async () => {
      const shareData = { productId: 'prd1234', variantId: null }
      mockCacheShareResolve.mockResolvedValue(shareData)

      const result = await db.shares.resolve('shr1234')

      expect(mockCacheShareResolve).toHaveBeenCalledWith(
        'shr1234',
        expect.any(Function)
      )
      expect(result).toEqual(shareData)
    })

    it('returns null when cacheShareResolve returns null', async () => {
      mockCacheShareResolve.mockResolvedValue(null)

      const result = await db.shares.resolve('nonexistent')

      expect(result).toBeNull()
    })

    it('fetcher resolves correct row data from DB when called directly', async () => {
      const dbRow = { productId: 'prd1234', variantId: 'var5678' }
      mockSharesFindFirst.mockResolvedValue(dbRow)

      mockCacheShareResolve.mockImplementation(
        async (_key: string, fetcher: () => Promise<unknown>) => fetcher()
      )

      const result = await db.shares.resolve('shr1234')

      expect(mockSharesFindFirst).toHaveBeenCalledOnce()
      expect(result).toEqual({ productId: 'prd1234', variantId: 'var5678' })
    })

    it('fetcher returns null when DB row not found', async () => {
      mockSharesFindFirst.mockResolvedValue(undefined)
      mockCacheShareResolve.mockImplementation(
        async (_key: string, fetcher: () => Promise<unknown>) => fetcher()
      )

      const result = await db.shares.resolve('missing')

      expect(result).toBeNull()
    })
  })
})
