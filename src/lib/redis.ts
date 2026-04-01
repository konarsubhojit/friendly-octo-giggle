import { Redis } from "@upstash/redis";
import { waitUntil } from "@vercel/functions";
import { logCacheOperation, logError, Timer } from "./logger";
import { env } from "./env";

let redis: Redis | null = null;

export const isRedisAvailable = (): boolean =>
  Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

export const getRedisClient = (): Redis | null => {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (redis) {
    return redis;
  }

  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  return redis;
};

const LOCK_TTL_SECONDS = 10;
const LOCK_RETRY_DELAY_MS = 100;
const REDIS_GLOB_PATTERN = /[*?[\]]/;

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
  const lockAcquired = await redisClient.set(lockKey, lockValue, {
    ex: LOCK_TTL_SECONDS,
    nx: true,
  });

  if (lockAcquired) {
    try {
      const fresh = await fetcher();
      const cacheData = { value: fresh, timestamp: Date.now() };
      await redisClient.setex(key, ttl + staleTime, cacheData);
      logCacheOperation({
        operation: "set",
        key,
        ttl: ttl + staleTime,
        success: true,
      });
      return fresh;
    } finally {
      await redisClient.eval(RELEASE_LOCK_SCRIPT, [lockKey], [lockValue]);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
  const retryData = await redisClient.get<{ value: T; timestamp: number }>(key);
  if (retryData) {
    return retryData.value;
  }

  return await fetcher();
};

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
    const cached = await redisClient.get<{ value: T; timestamp: number }>(key);

    if (cached) {
      const age = Date.now() - cached.timestamp;

      if (age < ttl * 1000) {
        timer.end({ cacheHit: true, age });
        logCacheOperation({ operation: "hit", key, success: true });
        return cached.value;
      }

      if (age < (ttl + staleTime) * 1000) {
        timer.end({ cacheHit: true, stale: true, age });
        logCacheOperation({ operation: "hit", key, success: true });

        waitUntil(
          (async () => {
            try {
              const fresh = await fetcher();
              const cacheData = { value: fresh, timestamp: Date.now() };
              await redisClient.setex(key, ttl + staleTime, cacheData);
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
          })(),
        );

        return cached.value;
      }
    }

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

  if (!redisClient) {
    return;
  }

  const timer = new Timer(`cache.invalidate.${pattern}`);
  try {
    if (!REDIS_GLOB_PATTERN.test(pattern)) {
      const deletedCount = await redisClient.del(pattern);

      if (deletedCount > 0) {
        logCacheOperation({
          operation: "invalidate",
          key: pattern,
          success: true,
        });
      }

      timer.end({ keysDeleted: deletedCount });
      return;
    }

    const keysToDelete: string[] = [];
    let cursor = 0;

    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, {
        match: pattern,
        count: 100,
      });
      cursor = Number(nextCursor);
      keysToDelete.push(...keys);
    } while (cursor !== 0);

    if (keysToDelete.length > 0) {
      const batchSize = 100;
      for (let index = 0; index < keysToDelete.length; index += batchSize) {
        const batch = keysToDelete.slice(index, index + batchSize);
        await redisClient.del(...batch);
      }
      logCacheOperation({
        operation: "invalidate",
        key: pattern,
        success: true,
      });
    }

    timer.end({ keysDeleted: keysToDelete.length });
  } catch (error) {
    timer.end({ error: true });
    logError({
      error,
      context: "cache_invalidation",
      additionalInfo: { pattern },
    });
  }
};
