import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  eval: vi.fn(),
  scan: vi.fn(),
};

const MockRedis = vi.fn(function () {
  return mockRedisInstance;
});

vi.mock("@upstash/redis", () => ({
  Redis: MockRedis,
}));

vi.mock("@/lib/env", () => ({
  env: {
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token", // NOSONAR - test fixture, not a real credential
  },
}));

vi.mock("@/lib/logger", () => ({
  logCacheOperation: vi.fn(),
  logError: vi.fn(),
  Timer: vi.fn(function () {
    return { end: vi.fn(() => 42) };
  }),
}));

const cachedJson = <T>(value: T, ageMs = 0): string => {
  return JSON.stringify({ value, timestamp: Date.now() - ageMs });
};

describe("getRedisClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    const { getRedisClient } = await import("@/lib/redis");
    const first = getRedisClient();
    const second = getRedisClient();
    expect(first).toBe(second);
  });

  it("initialises Redis with url and token from env", async () => {
    vi.doMock("@upstash/redis", () => ({ Redis: MockRedis }));
    vi.doMock("@/lib/env", () => ({
      env: {
        UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token", // NOSONAR
      },
    }));

    const { getRedisClient } = await import("@/lib/redis");
    getRedisClient();

    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://test.upstash.io",
        token: "test-token", // NOSONAR
      }),
    );
  });

  it("returns null when UPSTASH_REDIS_REST_URL is absent", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { UPSTASH_REDIS_REST_TOKEN: "test-token" }, // NOSONAR
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: MockRedis }));

    const { getRedisClient } = await import("@/lib/redis");
    const client = getRedisClient();

    expect(client).toBeNull();
  });

  it("returns null when UPSTASH_REDIS_REST_TOKEN is absent", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { UPSTASH_REDIS_REST_URL: "https://test.upstash.io" },
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: MockRedis }));

    const { getRedisClient } = await import("@/lib/redis");
    const client = getRedisClient();

    expect(client).toBeNull();
  });
});

describe("getCachedData", () => {
  let getCachedData: typeof import("@/lib/redis").getCachedData;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("@upstash/redis", () => ({ Redis: MockRedis }));
    vi.doMock("@/lib/env", () => ({
      env: {
        UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token", // NOSONAR
      },
    }));
    vi.doMock("@/lib/logger", () => ({
      logCacheOperation: vi.fn(),
      logError: vi.fn(),
      Timer: vi.fn(function () {
        return { end: vi.fn(() => 0) };
      }),
    }));

    mockRedisInstance.get.mockReset();
    mockRedisInstance.set.mockReset();
    mockRedisInstance.setex.mockReset();
    mockRedisInstance.del.mockReset();
    mockRedisInstance.eval.mockReset();

    const mod = await import("@/lib/redis");
    getCachedData = mod.getCachedData;
  });

  it("returns fresh cached data without calling the fetcher", async () => {
    const freshData = cachedJson("hello", 1_000);
    mockRedisInstance.get.mockResolvedValueOnce(freshData);
    const fetcher = vi.fn();

    const result = await getCachedData("key:1", 60, fetcher);

    expect(result).toBe("hello");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns stale data and triggers background revalidation", async () => {
    const staleData = cachedJson("stale-value", 61_000);
    mockRedisInstance.get.mockResolvedValueOnce(staleData);
    mockRedisInstance.setex.mockResolvedValue("OK");

    const fetcher = vi.fn().mockResolvedValue("fresh-value");

    const result = await getCachedData("key:2", 60, fetcher, 5);

    expect(result).toBe("stale-value");

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });
  });

  it("fetches, caches, and releases lock on cache miss with lock acquired", async () => {
    mockRedisInstance.get.mockResolvedValueOnce(null);
    mockRedisInstance.set.mockResolvedValueOnce("OK");
    mockRedisInstance.setex.mockResolvedValueOnce("OK");
    mockRedisInstance.eval.mockResolvedValueOnce(1);

    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    const result = await getCachedData("key:3", 60, fetcher);

    expect(result).toEqual({ id: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockRedisInstance.setex).toHaveBeenCalledWith(
      "key:3",
      65,
      expect.any(String),
    );
    expect(mockRedisInstance.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call"),
      ["lock:key:3"],
      [expect.any(String)],
    );
  });

  it("waits and returns retry data when lock is not acquired but data appears", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cachedJson("from-other-process", 0));

    mockRedisInstance.set.mockResolvedValueOnce(null);

    const fetcher = vi.fn();

    const result = await getCachedData("key:4", 60, fetcher);

    expect(result).toBe("from-other-process");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back to fetcher without caching when lock fails and retry misses", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mockRedisInstance.set.mockResolvedValueOnce(null);

    const fetcher = vi.fn().mockResolvedValue("fallback-data");

    const result = await getCachedData("key:5", 60, fetcher);

    expect(result).toBe("fallback-data");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockRedisInstance.setex).not.toHaveBeenCalled();
  });

  it("falls back to fetcher when redis.get throws an error", async () => {
    mockRedisInstance.get.mockRejectedValueOnce(new Error("Connection lost"));

    const fetcher = vi.fn().mockResolvedValue("error-fallback");

    const result = await getCachedData("key:6", 60, fetcher);

    expect(result).toBe("error-fallback");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe("invalidateCache", () => {
  let invalidateCache: typeof import("@/lib/redis").invalidateCache;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("@upstash/redis", () => ({ Redis: MockRedis }));
    vi.doMock("@/lib/env", () => ({
      env: {
        UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token", // NOSONAR
      },
    }));
    vi.doMock("@/lib/logger", () => ({
      logCacheOperation: vi.fn(),
      logError: vi.fn(),
      Timer: vi.fn(function () {
        return { end: vi.fn(() => 0) };
      }),
    }));

    mockRedisInstance.del.mockReset();
    mockRedisInstance.scan.mockReset();

    const mod = await import("@/lib/redis");
    invalidateCache = mod.invalidateCache;
  });

  it("deletes found keys in batches using cursor-based scan", async () => {
    const keys = Array.from({ length: 150 }, (_, index) => `product:${index}`);
    const batch1 = keys.slice(0, 100);
    const batch2 = keys.slice(100);

    mockRedisInstance.scan
      .mockResolvedValueOnce([42, batch1])
      .mockResolvedValueOnce([0, batch2]);
    mockRedisInstance.del.mockResolvedValue(0);

    await invalidateCache("product:*");

    expect(mockRedisInstance.del).toHaveBeenCalledTimes(2);
    expect(mockRedisInstance.del).toHaveBeenNthCalledWith(1, ...batch1);
    expect(mockRedisInstance.del).toHaveBeenNthCalledWith(2, ...batch2);
  });

  it("does not call del when no keys are found", async () => {
    mockRedisInstance.scan.mockResolvedValueOnce([0, []]);

    await invalidateCache("nonexistent:*");

    expect(mockRedisInstance.del).not.toHaveBeenCalled();
  });

  it("handles scan errors gracefully", async () => {
    mockRedisInstance.scan.mockRejectedValueOnce(new Error("scan failed"));

    await expect(invalidateCache("broken:*")).resolves.toBeUndefined();
  });
});

