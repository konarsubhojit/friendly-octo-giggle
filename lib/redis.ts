import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import { logCacheOperation, logError, Timer } from "./logger";
import { env } from "./env";

// Singleton Redis connection for serverless
let redis: Redis | null = null;

export const isRedisAvailable = (): boolean => Boolean(env.REDIS_URL);

const parseRedisUrl = (redisUrl: string): RedisOptions => {
  const parsedUrl = new URL(redisUrl);
  const dbStr = parsedUrl.pathname.slice(1);
  const dbNum = dbStr ? Number.parseInt(dbStr, 10) : 0;
  return {
    host: parsedUrl.hostname,
    port: Number.parseInt(parsedUrl.port || "6379", 10),
    password: parsedUrl.password || undefined,
    username: parsedUrl.username || undefined,
    db: Number.isNaN(dbNum) ? 0 : dbNum,
    tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  };
};

export const getRedisClient = (): Redis | null => {
  const redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (redis) {
    return redis;
  }

  redis = new Redis(parseRedisUrl(redisUrl));

  return redis;
};

// ─── Stampede Prevention ────────────────────────────────
// SRP: Lock acquisition/release is isolated from cache read/write logic.

const LOCK_TTL_SECONDS = 10;
const LOCK_RETRY_DELAY_MS = 100;

// Lua script to release lock only if we still own it (atomic check-and-delete)
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

const fetchWithStampedePrevention = async <T>(
  redisClient: Redis,
  key: string,
  ttl: number,
  staleTime: number,
  fetcher: () => Promise<T>,
): Promise<T> => {
  const lockKey = `lock:${key}`;
  const lockValue = crypto.randomUUID();
  const lockAcquired = await redisClient.set(
    lockKey,
    lockValue,
    "EX",
    LOCK_TTL_SECONDS,
    "NX",
  );

  if (lockAcquired) {
    try {
      const fresh = await fetcher();
      const cacheData = { value: fresh, timestamp: Date.now() };
      await redisClient.setex(key, ttl + staleTime, JSON.stringify(cacheData));
      logCacheOperation({
        operation: "set",
        key,
        ttl: ttl + staleTime,
        success: true,
      });
      return fresh;
    } finally {
      await redisClient.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockValue);
    }
  }

  // Another process holds the lock — wait briefly then check cache
  await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
  const retryData = await redisClient.get(key);
  if (retryData) {
    return JSON.parse(retryData).value as T;
  }

  // Fallback: fetch without caching (lock failed, no cached data appeared)
  return await fetcher();
};

// ─── Cache Read with Stale-While-Revalidate ─────────────

export const getCachedData = async <T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
  staleTime = 5,
): Promise<T> => {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return await fetcher();
  }

  const timer = new Timer(`cache.get.${key}`);

  try {
    const cached = await redisClient.get(key);

    if (cached) {
      const data = JSON.parse(cached) as { value: T; timestamp: number };
      const age = Date.now() - data.timestamp;

      // Fresh data — return immediately
      if (age < ttl * 1000) {
        timer.end({ cacheHit: true, age });
        logCacheOperation({ operation: "hit", key, success: true });
        return data.value;
      }

      if (age < (ttl + staleTime) * 1000) {
        timer.end({ cacheHit: true, stale: true, age });
        logCacheOperation({ operation: "hit", key, success: true });

        void (async () => {
          try {
            const fresh = await fetcher();
            const cacheData = { value: fresh, timestamp: Date.now() };
            await redisClient.setex(
              key,
              ttl + staleTime,
              JSON.stringify(cacheData),
            );
            logCacheOperation({
              operation: "set",
              key,
              ttl: ttl + staleTime,
              success: true,
            });
          } catch (revalidationError) {
            logError({
              error: revalidationError,
              context: "background_revalidation",
              additionalInfo: { key },
            });
          }
        })();

        return data.value;
      }
    }

    // Cache miss — fetch with stampede prevention
    logCacheOperation({ operation: "miss", key, success: true });
    const result = await fetchWithStampedePrevention(
      redisClient,
      key,
      ttl,
      staleTime,
      fetcher,
    );
    timer.end({ cacheHit: false, fetched: true });
    return result;
  } catch (error) {
    timer.end({ error: true });
    logError({ error, context: "cache_operation", additionalInfo: { key } });
    return await fetcher();
  }
};

export const invalidateCache = async (pattern: string): Promise<void> => {
  const redisClient = getRedisClient();

  // If Redis is not available, nothing to invalidate
  if (!redisClient) {
    return;
  }

  const timer = new Timer(`cache.invalidate.${pattern}`);
  try {
    // Use SCAN instead of KEYS to avoid blocking Redis
    const stream = redisClient.scanStream({
      match: pattern,
      count: 100,
    });

    const keysToDelete: string[] = [];

    stream.on("data", (keys: string[]) => {
      keysToDelete.push(...keys);
    });

    await new Promise<void>((resolve, reject) => {
      stream.on("end", async () => {
        try {
          if (keysToDelete.length > 0) {
            // Delete in batches to avoid overwhelming Redis
            const batchSize = 100;
            for (let i = 0; i < keysToDelete.length; i += batchSize) {
              const batch = keysToDelete.slice(i, i + batchSize);
              await redisClient.del(...batch);
            }
            logCacheOperation({
              operation: "invalidate",
              key: pattern,
              success: true,
            });
          }
          timer.end({ keysDeleted: keysToDelete.length });
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      stream.on("error", reject);
    });
  } catch (error) {
    timer.end({ error: true });
    logError({
      error,
      context: "cache_invalidation",
      additionalInfo: { pattern },
    });
  }
};
