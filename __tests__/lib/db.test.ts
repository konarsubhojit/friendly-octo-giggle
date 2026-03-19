import { describe, it, expect, vi, beforeEach } from "vitest";
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
} = vi.hoisted(() => {
  const mockReturningInsert = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockReturningInsert }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockReturningUpdate = vi.fn();
  const mockWhere = vi.fn(() => ({ returning: mockReturningUpdate }));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

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
  };
});
vi.mock("@neondatabase/serverless", () => ({
  Pool: vi.fn(),
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
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
}));

vi.mock("@/lib/schema", () => ({
  userRoleEnum: {},
  orderStatusEnum: {},
  users: {},
  accounts: {},
  sessions: {},
  verificationTokens: {},
  passwordHistory: {},
  products: { id: "id", deletedAt: "deletedAt" },
  productVariations: {},
  orders: {},
  orderItems: {},
  carts: {},
  cartItems: {},
  wishlists: {},
  reviews: {},
  usersRelations: {},
  accountsRelations: {},
  passwordHistoryRelations: {},
  sessionsRelations: {},
  productsRelations: {},
  productVariationsRelations: {},
  ordersRelations: {},
  orderItemsRelations: {},
  cartsRelations: {},
  cartItemsRelations: {},
  wishlistsRelations: {},
  reviewsRelations: {},
  productShares: {},
  productSharesRelations: {},
}));

vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgres://fake:fake@localhost:5432/fakedb",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/cache", () => ({
  cacheProductsList: mockCacheProductsList,
  cacheProductById: mockCacheProductById,
  invalidateProductCaches: mockInvalidateProductCaches,
  cacheShareResolve: mockCacheShareResolve,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  desc: vi.fn((col: unknown) => ({ op: "desc", col })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  isNull: vi.fn((col: unknown) => ({ op: "isNull", col })),
}));
import { db } from "@/lib/db";
const now = new Date("2025-01-15T10:00:00.000Z");

function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "abc1234",
    name: "Test Product",
    description: "A test product",
    price: 29.99,
    image: "https://example.com/img.jpg",
    stock: 10,
    category: "Electronics",
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    variations: [
      {
        id: "var0001",
        productId: "abc1234",
        name: "Red",
        designName: "red-design",
        image: null,
        priceModifier: 5,
        stock: 3,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
}

function expectedSerialized(overrides: Record<string, unknown> = {}) {
  return {
    id: "abc1234",
    name: "Test Product",
    description: "A test product",
    price: 29.99,
    image: "https://example.com/img.jpg",
    stock: 10,
    category: "Electronics",
    deletedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    variations: [
      {
        id: "var0001",
        productId: "abc1234",
        name: "Red",
        designName: "red-design",
        image: null,
        images: [],
        priceModifier: 5,
        stock: 3,
        deletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ],
    ...overrides,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mockInvalidateProductCaches.mockResolvedValue(undefined);
});

describe("db.products", () => {
  describe("findAll", () => {
    it("returns serialized products without cache", async () => {
      mockFindMany.mockResolvedValue([makeDbRow()]);

      const result = await db.products.findAll();

      expect(result).toEqual([expectedSerialized()]);
      expect(mockFindMany).toHaveBeenCalledOnce();
      expect(mockCacheProductsList).not.toHaveBeenCalled();
    });

    it("uses cache when withCache is true and no pagination", async () => {
      mockCacheProductsList.mockImplementation((fn: () => Promise<unknown>) =>
        fn(),
      );
      mockFindMany.mockResolvedValue([makeDbRow()]);

      const result = await db.products.findAll({ withCache: true });

      expect(result).toEqual([expectedSerialized()]);
      expect(mockCacheProductsList).toHaveBeenCalledOnce();
    });

    it("skips cache when pagination is provided even if withCache is true", async () => {
      mockFindMany.mockResolvedValue([makeDbRow()]);

      const result = await db.products.findAll({
        withCache: true,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual([expectedSerialized()]);
      expect(mockCacheProductsList).not.toHaveBeenCalled();
    });

    it("returns empty array when no products found", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await db.products.findAll();

      expect(result).toEqual([]);
    });
  });
  describe("findAllMinimal", () => {
    const minimalRow = {
      id: "abc1234",
      name: "Test Product",
      price: 29.99,
      stock: 10,
      category: "Electronics",
      image: "https://example.com/img.jpg",
    };

    it("returns minimal products without cache", async () => {
      mockFindMany.mockResolvedValue([minimalRow]);

      const result = await db.products.findAllMinimal();

      expect(result).toEqual([minimalRow]);
      expect(mockCacheProductsList).not.toHaveBeenCalled();
    });

    it("uses cache when withCache is true and no pagination", async () => {
      mockCacheProductsList.mockImplementation((fn: () => Promise<unknown>) =>
        fn(),
      );
      mockFindMany.mockResolvedValue([minimalRow]);

      const result = await db.products.findAllMinimal({ withCache: true });

      expect(result).toEqual([minimalRow]);
      expect(mockCacheProductsList).toHaveBeenCalledOnce();
    });

    it("skips cache when limit is provided", async () => {
      mockFindMany.mockResolvedValue([minimalRow]);

      const result = await db.products.findAllMinimal({
        withCache: true,
        limit: 5,
      });

      expect(result).toEqual([minimalRow]);
      expect(mockCacheProductsList).not.toHaveBeenCalled();
    });
  });
  describe("findById", () => {
    it("returns serialized product without cache", async () => {
      mockFindFirst.mockResolvedValue(makeDbRow());

      const result = await db.products.findById("abc1234");

      expect(result).toEqual(expectedSerialized());
      expect(mockFindFirst).toHaveBeenCalledOnce();
      expect(mockCacheProductById).not.toHaveBeenCalled();
    });

    it("uses cache when withCache is true", async () => {
      mockCacheProductById.mockImplementation(
        (_id: string, fn: () => Promise<unknown>) => fn(),
      );
      mockFindFirst.mockResolvedValue(makeDbRow());

      const result = await db.products.findById("abc1234", true);

      expect(result).toEqual(expectedSerialized());
      expect(mockCacheProductById).toHaveBeenCalledWith(
        "abc1234",
        expect.any(Function),
      );
    });

    it("returns null when product not found", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await db.products.findById("missing1");

      expect(result).toBeNull();
    });
  });
  describe("create", () => {
    it("inserts a product and invalidates caches", async () => {
      const input = {
        name: "New Product",
        description: "Brand new",
        price: 49.99,
        image: "https://example.com/new.jpg",
        stock: 20,
        category: "Apparel",
      };

      const dbRow = {
        id: "new1234",
        ...input,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      mockReturningInsert.mockResolvedValue([dbRow]);

      const result = await db.products.create(input);

      expect(mockInsert).toHaveBeenCalledOnce();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          ...input,
          updatedAt: expect.any(Date),
        }),
      );
      expect(result).toEqual({
        ...input,
        id: "new1234",
        deletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(mockInvalidateProductCaches).toHaveBeenCalledWith();
    });
  });
  describe("update", () => {
    it("updates a product and invalidates caches", async () => {
      const input = { name: "Updated Name", price: 39.99 };
      const dbRow = {
        id: "abc1234",
        name: "Updated Name",
        description: "A test product",
        price: 39.99,
        image: "https://example.com/img.jpg",
        stock: 10,
        category: "Electronics",
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      mockReturningUpdate.mockResolvedValue([dbRow]);

      const result = await db.products.update("abc1234", input);

      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ...input,
          updatedAt: expect.any(Date),
        }),
      );
      expect(result).toEqual({
        id: "abc1234",
        name: "Updated Name",
        description: "A test product",
        price: 39.99,
        image: "https://example.com/img.jpg",
        stock: 10,
        category: "Electronics",
        deletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(mockInvalidateProductCaches).toHaveBeenCalledWith("abc1234");
    });

    it("returns null when product does not exist", async () => {
      mockReturningUpdate.mockResolvedValue([undefined]);

      const result = await db.products.update("missing1", { name: "Nope" });

      expect(result).toBeNull();
    });
  });
  describe("delete", () => {
    it("soft-deletes a product and invalidates caches", async () => {
      mockReturningUpdate.mockResolvedValue([{ id: "abc1234" }]);

      const result = await db.products.delete("abc1234");

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
      expect(mockInvalidateProductCaches).toHaveBeenCalledWith("abc1234");
    });

    it("returns false and skips cache invalidation when product not found", async () => {
      mockReturningUpdate.mockResolvedValue([]);

      const result = await db.products.delete("missing1");

      expect(result).toBe(false);
      expect(mockInvalidateProductCaches).not.toHaveBeenCalled();
    });
  });
});

describe("db.shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("inserts a share record and returns the key", async () => {
      mockReturningInsert.mockResolvedValue([{ key: "shr1234" }]);

      const result = await db.shares.create("prd1234", null);

      expect(mockInsert).toHaveBeenCalledOnce();
      expect(mockValues).toHaveBeenCalledWith({
        productId: "prd1234",
        variationId: null,
      });
      expect(result).toBe("shr1234");
    });

    it("inserts a share record with a variationId", async () => {
      mockReturningInsert.mockResolvedValue([{ key: "shr5678" }]);

      const result = await db.shares.create("prd1234", "var5678");

      expect(mockValues).toHaveBeenCalledWith({
        productId: "prd1234",
        variationId: "var5678",
      });
      expect(result).toBe("shr5678");
    });
  });

  describe("resolve", () => {
    it("calls cacheShareResolve with the correct key and returns the result", async () => {
      const shareData = { productId: "prd1234", variationId: null };
      mockCacheShareResolve.mockResolvedValue(shareData);

      const result = await db.shares.resolve("shr1234");

      expect(mockCacheShareResolve).toHaveBeenCalledWith(
        "shr1234",
        expect.any(Function),
      );
      expect(result).toEqual(shareData);
    });

    it("returns null when cacheShareResolve returns null", async () => {
      mockCacheShareResolve.mockResolvedValue(null);

      const result = await db.shares.resolve("nonexistent");

      expect(result).toBeNull();
    });

    it("fetcher resolves correct row data from DB when called directly", async () => {
      const dbRow = { productId: "prd1234", variationId: "var5678" };
      mockSharesFindFirst.mockResolvedValue(dbRow);

      mockCacheShareResolve.mockImplementation(
        async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
      );

      const result = await db.shares.resolve("shr1234");

      expect(mockSharesFindFirst).toHaveBeenCalledOnce();
      expect(result).toEqual({ productId: "prd1234", variationId: "var5678" });
    });

    it("fetcher returns null when DB row not found", async () => {
      mockSharesFindFirst.mockResolvedValue(undefined);
      mockCacheShareResolve.mockImplementation(
        async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
      );

      const result = await db.shares.resolve("missing");

      expect(result).toBeNull();
    });
  });
});
