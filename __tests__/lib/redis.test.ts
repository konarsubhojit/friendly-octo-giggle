import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// --- Mocks ---

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  eval: vi.fn(),
  scanStream: vi.fn(),
};

// Must use a real function (not arrow) so it can be called with `new`
function MockRedis() {
  return mockRedisInstance;
}

vi.mock("ioredis", () => {
  return {
    default: MockRedis,
  };
});

vi.mock("@/lib/env", () => ({
  env: { REDIS_URL: "redis://localhost:6379" },
}));

vi.mock("@/lib/logger", () => ({
  logCacheOperation: vi.fn(),
  logError: vi.fn(),
  Timer: vi.fn(function () {
    return { end: vi.fn(() => 42) };
  }),
}));

// Helper to build a cached JSON string
function cachedJson<T>(value: T, ageMs = 0): string {
  return JSON.stringify({ value, timestamp: Date.now() - ageMs });
}

// ---------- getRedisClient ----------

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

  it("parses a basic redis:// URL correctly", async () => {
    const RedisSpy = vi.fn(function () {
      return mockRedisInstance;
    });
    vi.doMock("ioredis", () => ({ default: RedisSpy }));
    const { getRedisClient } = await import("@/lib/redis");
    getRedisClient();

    expect(RedisSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "localhost",
        port: 6379,
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        lazyConnect: true,
        tls: undefined,
      }),
    );
  });

  it("enables TLS for rediss:// protocol", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { REDIS_URL: "rediss://user:pass@secure.host:6380/2" },
    }));
    const RedisSpy = vi.fn(function () {
      return mockRedisInstance;
    });
    vi.doMock("ioredis", () => ({ default: RedisSpy }));

    const { getRedisClient } = await import("@/lib/redis");
    getRedisClient();

    expect(RedisSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "secure.host",
        port: 6380,
        password: "pass",
        username: "user",
        db: 2,
        tls: {},
      }),
    );
  });
});

// ---------- getCachedData ----------

describe("getCachedData", () => {
  let getCachedData: typeof import("@/lib/redis").getCachedData;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Re-mock ioredis so the fresh module picks up the same mock instance
    vi.doMock("ioredis", () => ({ default: MockRedis }));
    vi.doMock("@/lib/env", () => ({
      env: { REDIS_URL: "redis://localhost:6379" },
    }));
    vi.doMock("@/lib/logger", () => ({
      logCacheOperation: vi.fn(),
      logError: vi.fn(),
      Timer: vi.fn(function () {
        return { end: vi.fn(() => 0) };
      }),
    }));

    // Reset per-test mock implementations
    mockRedisInstance.get.mockReset();
    mockRedisInstance.set.mockReset();
    mockRedisInstance.setex.mockReset();
    mockRedisInstance.del.mockReset();
    mockRedisInstance.eval.mockReset();

    const mod = await import("@/lib/redis");
    getCachedData = mod.getCachedData;
  });

  it("returns fresh cached data without calling the fetcher", async () => {
    const freshData = cachedJson("hello", 1_000); // 1 s old, ttl=60 → fresh
    mockRedisInstance.get.mockResolvedValueOnce(freshData);
    const fetcher = vi.fn();

    const result = await getCachedData("key:1", 60, fetcher);

    expect(result).toBe("hello");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns stale data and triggers background revalidation", async () => {
    const staleAgeMs = 61_000; // 61 s old, ttl=60, staleTime=5 → within stale window
    const staleData = cachedJson("stale-value", staleAgeMs);
    mockRedisInstance.get.mockResolvedValueOnce(staleData);
    mockRedisInstance.setex.mockResolvedValue("OK");

    const fetcher = vi.fn().mockResolvedValue("fresh-value");
    const realSetImmediate = globalThis.setImmediate;
    const setImmediateSpy = vi
      .spyOn(globalThis, "setImmediate")
      .mockImplementation((cb: (...args: unknown[]) => void) =>
        realSetImmediate(cb),
      );

    const result = await getCachedData("key:2", 60, fetcher, 5);

    expect(result).toBe("stale-value");
    expect(setImmediateSpy).toHaveBeenCalled();

    // Let the background revalidation run
    await new Promise((r) => realSetImmediate(r));

    setImmediateSpy.mockRestore();
  });

  it("fetches, caches, and releases lock on cache miss with lock acquired", async () => {
    mockRedisInstance.get.mockResolvedValueOnce(null); // cache miss
    mockRedisInstance.set.mockResolvedValueOnce("OK"); // lock acquired
    mockRedisInstance.setex.mockResolvedValueOnce("OK");
    mockRedisInstance.eval.mockResolvedValueOnce(1); // lock release

    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    const result = await getCachedData("key:3", 60, fetcher);

    expect(result).toEqual({ id: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockRedisInstance.setex).toHaveBeenCalledWith(
      "key:3",
      65, // ttl + staleTime (60+5)
      expect.any(String),
    );
    expect(mockRedisInstance.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call"),
      1,
      "lock:key:3",
      expect.any(String),
    );
  });

  it("waits and returns retry data when lock is not acquired but data appears", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(null) // first get → miss
      .mockResolvedValueOnce(cachedJson("from-other-process", 0)); // retry get → hit

    mockRedisInstance.set.mockResolvedValueOnce(null); // lock NOT acquired

    const fetcher = vi.fn();

    const result = await getCachedData("key:4", 60, fetcher);

    expect(result).toBe("from-other-process");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back to fetcher without caching when lock fails and retry misses", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(null) // first get → miss
      .mockResolvedValueOnce(null); // retry get → still miss

    mockRedisInstance.set.mockResolvedValueOnce(null); // lock NOT acquired

    const fetcher = vi.fn().mockResolvedValue("fallback-data");

    const result = await getCachedData("key:5", 60, fetcher);

    expect(result).toBe("fallback-data");
    expect(fetcher).toHaveBeenCalledOnce();
    // Should NOT have cached since lock wasn't held
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

// ---------- invalidateCache ----------

describe("invalidateCache", () => {
  let invalidateCache: typeof import("@/lib/redis").invalidateCache;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("ioredis", () => ({ default: MockRedis }));
    vi.doMock("@/lib/env", () => ({
      env: { REDIS_URL: "redis://localhost:6379" },
    }));
    vi.doMock("@/lib/logger", () => ({
      logCacheOperation: vi.fn(),
      logError: vi.fn(),
      Timer: vi.fn(function () {
        return { end: vi.fn(() => 0) };
      }),
    }));

    mockRedisInstance.del.mockReset();
    mockRedisInstance.scanStream.mockReset();

    const mod = await import("@/lib/redis");
    invalidateCache = mod.invalidateCache;
  });

  /** Utility: create a fake scanStream that emits given batches then ends */
  function fakeScanStream(batches: string[][]) {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
      on(event: string, cb: (...args: unknown[]) => void) {
        (listeners[event] ??= []).push(cb);
        // Emit data + end asynchronously so the promise wiring in invalidateCache registers first
        if (event === "end") {
          queueMicrotask(() => {
            for (const batch of batches) {
              for (const fn of listeners["data"] ?? []) fn(batch);
            }
            for (const fn of listeners["end"] ?? []) fn();
          });
        }
        return this;
      },
    };
  }

  it("deletes found keys in batches", async () => {
    const keys = Array.from({ length: 150 }, (_, i) => `product:${i}`);
    const batch1 = keys.slice(0, 100);
    const batch2 = keys.slice(100);

    mockRedisInstance.scanStream.mockReturnValueOnce(
      fakeScanStream([batch1, batch2]),
    );
    mockRedisInstance.del.mockResolvedValue(0);

    await invalidateCache("product:*");

    // Two del calls: one for first 100, one for remaining 50
    expect(mockRedisInstance.del).toHaveBeenCalledTimes(2);
    expect(mockRedisInstance.del).toHaveBeenNthCalledWith(1, ...batch1);
    expect(mockRedisInstance.del).toHaveBeenNthCalledWith(2, ...batch2);
  });

  it("does not call del when no keys are found", async () => {
    mockRedisInstance.scanStream.mockReturnValueOnce(fakeScanStream([]));

    await invalidateCache("nonexistent:*");

    expect(mockRedisInstance.del).not.toHaveBeenCalled();
  });

  it("handles scanStream errors gracefully", async () => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    mockRedisInstance.scanStream.mockReturnValueOnce({
      on(event: string, cb: (...args: unknown[]) => void) {
        (listeners[event] ??= []).push(cb);
        if (event === "end") {
          queueMicrotask(() => {
            for (const fn of listeners["error"] ?? [])
              fn(new Error("scan failed"));
          });
        }
        return this;
      },
    });

    // Should not throw – error is caught internally
    await expect(invalidateCache("broken:*")).resolves.toBeUndefined();
  });
});
