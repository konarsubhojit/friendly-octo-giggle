import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockDelete,
  mockIndex,
  mockInfo,
  mockReset,
  mockSearch,
  mockSelect,
  mockUpsert,
} = vi.hoisted(() => {
  const hoistedMockUpsert = vi.fn().mockResolvedValue("Success");
  const hoistedMockDelete = vi.fn().mockResolvedValue({ deleted: 1 });
  const hoistedMockSearch = vi.fn().mockResolvedValue({ results: [] });
  const hoistedMockReset = vi.fn().mockResolvedValue(undefined);
  const hoistedMockInfo = vi.fn().mockResolvedValue({ name: "products" });
  const hoistedMockWhere = vi
    .fn()
    .mockResolvedValue([{ name: "Handbag" }, { name: "Flowers" }]);
  const hoistedMockFrom = vi.fn(() => ({ where: hoistedMockWhere }));
  const hoistedMockSelect = vi.fn(() => ({ from: hoistedMockFrom }));
  const hoistedMockIndex = vi.fn(() => ({
    upsert: hoistedMockUpsert,
    delete: hoistedMockDelete,
    search: hoistedMockSearch,
    reset: hoistedMockReset,
    info: hoistedMockInfo,
  }));

  return {
    mockDelete: hoistedMockDelete,
    mockIndex: hoistedMockIndex,
    mockInfo: hoistedMockInfo,
    mockReset: hoistedMockReset,
    mockSearch: hoistedMockSearch,
    mockSelect: hoistedMockSelect,
    mockUpsert: hoistedMockUpsert,
  };
});

vi.mock("@upstash/search", () => ({
  Search: vi.fn().mockImplementation(function () {
    return { index: mockIndex };
  }),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    select: mockSelect,
  },
}));
vi.mock("@/lib/schema", () => ({
  categories: { name: "name", deletedAt: "deletedAt" },
}));
vi.mock("drizzle-orm", () => ({
  isNull: vi.fn(),
}));

import {
  isSearchAvailable,
  indexProduct,
  indexProducts,
  removeProduct,
  searchProducts,
  resetIndex,
  getIndexInfo,
} from "@/lib/search";

describe("lib/search", () => {
  let origUrl: string | undefined;
  let origToken: string | undefined;

  const restoreEnvValue = (
    key: "UPSTASH_SEARCH_REST_URL" | "UPSTASH_SEARCH_REST_TOKEN",
    value: string | undefined,
  ) => {
    if (value == null) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    origUrl = process.env.UPSTASH_SEARCH_REST_URL;
    origToken = process.env.UPSTASH_SEARCH_REST_TOKEN;
    // Default: search is available
    process.env.UPSTASH_SEARCH_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_SEARCH_REST_TOKEN = "test-token";
  });

  afterEach(() => {
    // Restore original env vars
    restoreEnvValue("UPSTASH_SEARCH_REST_URL", origUrl);
    restoreEnvValue("UPSTASH_SEARCH_REST_TOKEN", origToken);
  });

  // ─── isSearchAvailable ──────────────────────────────────

  describe("isSearchAvailable", () => {
    it("returns false when env vars are not set", () => {
      delete process.env.UPSTASH_SEARCH_REST_URL;
      delete process.env.UPSTASH_SEARCH_REST_TOKEN;

      expect(isSearchAvailable()).toBe(false);
    });

    it("returns true when env vars are set", () => {
      expect(isSearchAvailable()).toBe(true);
    });
  });

  // ─── indexProduct ───────────────────────────────────────

  describe("indexProduct", () => {
    it("upserts a single product document", async () => {
      await expect(
        indexProduct({
          id: "abc1234",
          name: "Cotton Shirt",
          description: "Soft cotton shirt",
          category: "Clothing",
          price: 29.99,
          stock: 50,
          image: "https://example.com/shirt.jpg",
        }),
      ).resolves.toBe(true);

      expect(mockIndex).toHaveBeenCalledWith("products");
      expect(mockUpsert).toHaveBeenCalledWith({
        id: "abc1234",
        content: {
          name: "Cotton Shirt",
          description: "Soft cotton shirt",
          category: "Clothing",
          price: 29.99,
          stock: 50,
        },
        metadata: {
          image: "https://example.com/shirt.jpg",
        },
      });
    });

    it("is a no-op when search is not available", async () => {
      delete process.env.UPSTASH_SEARCH_REST_URL;
      delete process.env.UPSTASH_SEARCH_REST_TOKEN;

      await expect(
        indexProduct({
          id: "abc1234",
          name: "Test",
          description: "Test",
          category: "Test",
          price: 10,
          stock: 1,
          image: "https://example.com/test.jpg",
        }),
      ).resolves.toBe(false);

      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("throws when requested and indexing fails", async () => {
      const error = new Error("Upstash failure");
      mockUpsert.mockRejectedValueOnce(error);

      await expect(
        indexProduct(
          {
            id: "abc1234",
            name: "Test",
            description: "Test",
            category: "Test",
            price: 10,
            stock: 1,
            image: "https://example.com/test.jpg",
          },
          { throwOnError: true },
        ),
      ).rejects.toThrow("Upstash failure");
    });
  });

  // ─── indexProducts (batch) ──────────────────────────────

  describe("indexProducts", () => {
    it("upserts multiple products in a batch", async () => {
      const products = [
        {
          id: "p1",
          name: "Product 1",
          description: "Desc 1",
          category: "Cat A",
          price: 10,
          stock: 5,
          image: "https://example.com/1.jpg",
        },
        {
          id: "p2",
          name: "Product 2",
          description: "Desc 2",
          category: "Cat B",
          price: 20,
          stock: 10,
          image: "https://example.com/2.jpg",
        },
      ];

      await expect(indexProducts(products)).resolves.toBe(true);

      expect(mockUpsert).toHaveBeenCalledWith(
        products.map((p) => ({
          id: p.id,
          content: {
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            stock: p.stock,
          },
          metadata: { image: p.image },
        })),
      );
    });

    it("skips when list is empty", async () => {
      await expect(indexProducts([])).resolves.toBe(true);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("splits writes into batches of 100", async () => {
      const products = Array.from({ length: 101 }, (_, index) => ({
        id: `p${index + 1}`,
        name: `Product ${index + 1}`,
        description: `Desc ${index + 1}`,
        category: "Cat A",
        price: 10 + index,
        stock: 5 + index,
        image: `https://example.com/${index + 1}.jpg`,
      }));

      await expect(indexProducts(products)).resolves.toBe(true);

      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(mockUpsert.mock.calls[0]?.[0]).toHaveLength(100);
      expect(mockUpsert.mock.calls[1]?.[0]).toHaveLength(1);
    });

    it("throws when requested and batch indexing fails", async () => {
      mockUpsert.mockRejectedValueOnce(new Error("Batch failure"));

      await expect(
        indexProducts(
          [
            {
              id: "p1",
              name: "Product 1",
              description: "Desc 1",
              category: "Cat A",
              price: 10,
              stock: 5,
              image: "https://example.com/1.jpg",
            },
          ],
          { throwOnError: true },
        ),
      ).rejects.toThrow("Batch failure");
    });
  });

  // ─── removeProduct ──────────────────────────────────────

  describe("removeProduct", () => {
    it("deletes a product by ID", async () => {
      await removeProduct("abc1234");

      expect(mockIndex).toHaveBeenCalledWith("products");
      expect(mockDelete).toHaveBeenCalledWith("abc1234");
    });
  });

  // ─── searchProducts ─────────────────────────────────────

  describe("searchProducts", () => {
    it("calls search with query and returns mapped results", async () => {
      mockSearch.mockResolvedValueOnce([
        {
          id: "p1",
          score: 0.95,
          content: {
            name: "Cotton Shirt",
            description: "Soft",
            category: "Handbag",
            price: 29.99,
            stock: 10,
          },
          metadata: { image: "https://example.com/shirt.jpg" },
        },
      ]);

      const results = await searchProducts("cotton");

      expect(mockIndex).toHaveBeenCalledWith("products");
      expect(mockSearch).toHaveBeenCalledWith({
        query: "cotton",
        limit: 20,
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("p1");
      expect(results[0].score).toBe(0.95);
      expect(results[0].content.name).toBe("Cotton Shirt");
    });

    it("passes category filter when provided", async () => {
      mockSearch.mockResolvedValueOnce([]);

      await searchProducts("shirt", { category: "Handbag" });

      expect(mockSearch).toHaveBeenCalledWith({
        query: "shirt",
        limit: 20,
        filter: {
          category: {
            equals: "Handbag",
          },
        },
      });
    });

    it("returns empty array when search is not available", async () => {
      delete process.env.UPSTASH_SEARCH_REST_URL;
      delete process.env.UPSTASH_SEARCH_REST_TOKEN;

      const results = await searchProducts("anything");
      expect(results).toEqual([]);
    });
  });

  // ─── resetIndex ─────────────────────────────────────────

  describe("resetIndex", () => {
    it("resets the specified index", async () => {
      await resetIndex("products");

      expect(mockIndex).toHaveBeenCalledWith("products");
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe("getIndexInfo", () => {
    it("returns index metadata", async () => {
      await expect(getIndexInfo("products")).resolves.toEqual({
        name: "products",
      });

      expect(mockInfo).toHaveBeenCalled();
    });
  });
});
