import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @upstash/search before importing the module under test
const mockUpsert = vi.fn().mockResolvedValue("Success");
const mockDelete = vi.fn().mockResolvedValue({ deleted: 1 });
const mockSearch = vi.fn().mockResolvedValue({ results: [] });
const mockReset = vi.fn().mockResolvedValue(undefined);

const mockIndex = vi.fn(() => ({
  upsert: mockUpsert,
  delete: mockDelete,
  search: mockSearch,
  reset: mockReset,
}));

vi.mock("@upstash/search", () => ({
  Search: vi.fn().mockImplementation(function () {
    return { index: mockIndex };
  }),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

const mockWhere = vi
  .fn()
  .mockResolvedValue([{ name: "Handbag" }, { name: "Flowers" }]);
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    select: (...args: unknown[]) => mockSelect(...args),
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
} from "@/lib/search";

describe("lib/search", () => {
  let origUrl: string | undefined;
  let origToken: string | undefined;

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
    if (origUrl !== undefined) {
      process.env.UPSTASH_SEARCH_REST_URL = origUrl;
    } else {
      delete process.env.UPSTASH_SEARCH_REST_URL;
    }
    if (origToken !== undefined) {
      process.env.UPSTASH_SEARCH_REST_TOKEN = origToken;
    } else {
      delete process.env.UPSTASH_SEARCH_REST_TOKEN;
    }
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
      await indexProduct({
        id: "abc1234",
        name: "Cotton Shirt",
        description: "Soft cotton shirt",
        category: "Clothing",
        price: 29.99,
        stock: 50,
        image: "https://example.com/shirt.jpg",
      });

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

      await indexProduct({
        id: "abc1234",
        name: "Test",
        description: "Test",
        category: "Test",
        price: 10,
        stock: 1,
        image: "https://example.com/test.jpg",
      });

      expect(mockUpsert).not.toHaveBeenCalled();
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

      await indexProducts(products);

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
      await indexProducts([]);
      expect(mockUpsert).not.toHaveBeenCalled();
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
        filter: "category = 'Handbag'",
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
});
