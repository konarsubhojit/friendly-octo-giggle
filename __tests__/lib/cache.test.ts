import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(),
  invalidateCache: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logCacheOperation: vi.fn(),
  logError: vi.fn(),
}));

import {
  CACHE_KEYS,
  CACHE_TTL,
  cacheProductsList,
  cacheProductById,
  invalidateProductCaches,
  invalidateCartCache,
  invalidateUserOrderCaches,
} from "@/lib/cache";
import { getCachedData, invalidateCache } from "@/lib/redis";
import { logCacheOperation, logError } from "@/lib/logger";

const mockGetCachedData = vi.mocked(getCachedData);
const mockInvalidateCache = vi.mocked(invalidateCache);
const mockLogError = vi.mocked(logError);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CACHE_KEYS", () => {
  describe("static values", () => {
    it("has correct PRODUCTS_ALL key", () => {
      expect(CACHE_KEYS.PRODUCTS_ALL).toBe("products:all");
    });

    it("has correct PRODUCTS_PATTERN key", () => {
      expect(CACHE_KEYS.PRODUCTS_PATTERN).toBe("products:*");
    });

    it("has correct PRODUCT_PATTERN key", () => {
      expect(CACHE_KEYS.PRODUCT_PATTERN).toBe("product:*");
    });

    it("has correct CART_PATTERN key", () => {
      expect(CACHE_KEYS.CART_PATTERN).toBe("cart:*");
    });

    it("has correct ADMIN_PRODUCTS_ALL key", () => {
      expect(CACHE_KEYS.ADMIN_PRODUCTS_ALL).toBe("admin:products:all");
    });

    it("has correct ADMIN_PRODUCTS_PATTERN key", () => {
      expect(CACHE_KEYS.ADMIN_PRODUCTS_PATTERN).toBe("admin:products:*");
    });
  });

  describe("dynamic key functions", () => {
    it("PRODUCT_BY_ID returns correct key", () => {
      expect(CACHE_KEYS.PRODUCT_BY_ID("abc-123")).toBe("product:abc-123");
    });

    it("CART_BY_USER returns correct key", () => {
      expect(CACHE_KEYS.CART_BY_USER("user-1")).toBe("cart:user:user-1");
    });

    it("CART_BY_SESSION returns correct key", () => {
      expect(CACHE_KEYS.CART_BY_SESSION("sess-1")).toBe("cart:session:sess-1");
    });

    it("ORDERS_BY_USER returns correct key", () => {
      expect(CACHE_KEYS.ORDERS_BY_USER("user-1")).toBe("orders:user:user-1");
    });

    it("ORDER_BY_ID returns correct key", () => {
      expect(CACHE_KEYS.ORDER_BY_ID("user-1", "order-1")).toBe(
        "order:user-1:order-1",
      );
    });

    it("ORDERS_USER_PATTERN returns correct key", () => {
      expect(CACHE_KEYS.ORDERS_USER_PATTERN("user-1")).toBe(
        "orders:user:user-1",
      );
    });

    it("ORDER_USER_PATTERN returns correct key", () => {
      expect(CACHE_KEYS.ORDER_USER_PATTERN("user-1")).toBe("order:user-1:*");
    });
  });
});

describe("CACHE_TTL", () => {
  it("has correct TTL values", () => {
    expect(CACHE_TTL.PRODUCTS_LIST).toBe(60);
    expect(CACHE_TTL.PRODUCT_DETAIL).toBe(300);
    expect(CACHE_TTL.STALE_TIME).toBe(10);
    expect(CACHE_TTL.CART).toBe(30);
    expect(CACHE_TTL.CART_STALE).toBe(5);
    expect(CACHE_TTL.USER_ORDERS).toBe(60);
    expect(CACHE_TTL.USER_ORDERS_STALE).toBe(10);
    expect(CACHE_TTL.ORDER_DETAIL).toBe(120);
    expect(CACHE_TTL.ORDER_DETAIL_STALE).toBe(10);
    expect(CACHE_TTL.ADMIN_PRODUCTS).toBe(60);
    expect(CACHE_TTL.ADMIN_PRODUCTS_STALE).toBe(10);
  });
});

describe("cacheProductsList", () => {
  it("calls getCachedData with correct arguments", async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: "1", name: "Product" }]);
    mockGetCachedData.mockResolvedValue([{ id: "1", name: "Product" }]);

    await cacheProductsList(fetcher);

    expect(mockGetCachedData).toHaveBeenCalledWith(
      "products:all",
      60,
      fetcher,
      10,
    );
  });

  it("returns the result from getCachedData", async () => {
    const data = [{ id: "1" }];
    mockGetCachedData.mockResolvedValue(data);

    const result = await cacheProductsList(vi.fn());

    expect(result).toBe(data);
  });
});

describe("cacheProductById", () => {
  it("calls getCachedData with correct arguments", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: "p1" });
    mockGetCachedData.mockResolvedValue({ id: "p1" });

    await cacheProductById("p1", fetcher);

    expect(mockGetCachedData).toHaveBeenCalledWith(
      "product:p1",
      300,
      fetcher,
      10,
    );
  });

  it("returns the result from getCachedData", async () => {
    const data = { id: "p1" };
    mockGetCachedData.mockResolvedValue(data);

    const result = await cacheProductById("p1", vi.fn());

    expect(result).toBe(data);
  });
});

describe("invalidateProductCaches", () => {
  it("calls invalidateCache twice without productId", async () => {
    await invalidateProductCaches();

    expect(mockInvalidateCache).toHaveBeenCalledTimes(2);
    expect(mockInvalidateCache).toHaveBeenCalledWith("products:*");
    expect(mockInvalidateCache).toHaveBeenCalledWith("admin:products:*");
  });

  it("calls invalidateCache 3 times with productId", async () => {
    await invalidateProductCaches("p1");

    expect(mockInvalidateCache).toHaveBeenCalledTimes(3);
    expect(mockInvalidateCache).toHaveBeenCalledWith("products:*");
    expect(mockInvalidateCache).toHaveBeenCalledWith("admin:products:*");
    expect(mockInvalidateCache).toHaveBeenCalledWith("product:p1");
  });

  it("calls logCacheOperation on success without productId", async () => {
    await invalidateProductCaches();

    expect(logCacheOperation).toHaveBeenCalledWith({
      operation: "invalidate",
      key: "products:*",
      success: true,
    });
  });

  it("calls logCacheOperation on success with productId", async () => {
    await invalidateProductCaches("p1");

    expect(logCacheOperation).toHaveBeenCalledWith({
      operation: "invalidate",
      key: "products:* and product:p1",
      success: true,
    });
  });

  it("handles errors by calling logError", async () => {
    const error = new Error("Redis down");
    mockInvalidateCache.mockRejectedValueOnce(error);

    await invalidateProductCaches();

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: "cache_invalidation",
    });
  });
});

describe("invalidateCartCache", () => {
  it("invalidates user cart when userId provided", async () => {
    await invalidateCartCache("user-1");

    expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
    expect(mockInvalidateCache).toHaveBeenCalledWith("cart:user:user-1");
  });

  it("invalidates session cart when sessionId provided", async () => {
    await invalidateCartCache(undefined, "sess-1");

    expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
    expect(mockInvalidateCache).toHaveBeenCalledWith("cart:session:sess-1");
  });

  it("invalidates both when userId and sessionId provided", async () => {
    await invalidateCartCache("user-1", "sess-1");

    expect(mockInvalidateCache).toHaveBeenCalledTimes(2);
    expect(mockInvalidateCache).toHaveBeenCalledWith("cart:user:user-1");
    expect(mockInvalidateCache).toHaveBeenCalledWith("cart:session:sess-1");
  });

  it("does not call invalidateCache when neither provided", async () => {
    await invalidateCartCache();

    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });

  it("handles errors by calling logError", async () => {
    const error = new Error("Redis down");
    mockInvalidateCache.mockRejectedValueOnce(error);

    await invalidateCartCache("user-1");

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: "cart_cache_invalidation",
    });
  });
});

describe("invalidateUserOrderCaches", () => {
  it("calls invalidateCache twice with correct patterns", async () => {
    await invalidateUserOrderCaches("user-1");

    expect(mockInvalidateCache).toHaveBeenCalledTimes(2);
    expect(mockInvalidateCache).toHaveBeenCalledWith("orders:user:user-1");
    expect(mockInvalidateCache).toHaveBeenCalledWith("order:user-1:*");
  });

  it("handles errors by calling logError", async () => {
    const error = new Error("Redis down");
    mockInvalidateCache.mockRejectedValueOnce(error);

    await invalidateUserOrderCaches("user-1");

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: "order_cache_invalidation",
    });
  });
});
