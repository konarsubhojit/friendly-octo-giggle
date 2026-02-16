import Redis from 'ioredis';
import { logCacheOperation, logError, Timer } from './logger';
import { env } from './env';

// Singleton Redis connection for serverless
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
  redis ??= new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  return redis;
}

// Cache stampede prevention using stale-while-revalidate pattern
export async function getCachedData<T>(
  key: string,
  ttl: number, // Time to live in seconds
  fetcher: () => Promise<T>,
  staleTime = 5 // Extra time to serve stale data while revalidating
): Promise<T> {
  const redis = getRedisClient();
  const timer = new Timer(`cache.get.${key}`);
  
  try {
    // Try to get cached data
    const cached = await redis.get(key);
    
    if (cached) {
      const data = JSON.parse(cached) as { value: T; timestamp: number };
      const age = Date.now() - data.timestamp;
      
      // If data is fresh, return it
      if (age < ttl * 1000) {
        timer.end({ cacheHit: true, age });
        logCacheOperation({ operation: 'hit', key, success: true });
        return data.value;
      }
      
      // If data is stale but within stale-while-revalidate window
      if (age < (ttl + staleTime) * 1000) {
        // Return stale data immediately
        const staleData = data.value;
        timer.end({ cacheHit: true, stale: true, age });
        logCacheOperation({ operation: 'hit', key, success: true });
        
        // Trigger background revalidation (non-blocking)
        setImmediate(async () => {
          try {
            const fresh = await fetcher();
            const cacheData = {
              value: fresh,
              timestamp: Date.now(),
            };
            await redis.setex(key, ttl + staleTime, JSON.stringify(cacheData));
            logCacheOperation({ operation: 'set', key, ttl: ttl + staleTime, success: true });
          } catch (error) {
            logError({ error, context: 'background_revalidation', additionalInfo: { key } });
          }
        });
        
        return staleData;
      }
    }
    
    // Cache miss
    logCacheOperation({ operation: 'miss', key, success: true });
    
    // Use distributed lock to prevent stampede
    const lockKey = `lock:${key}`;
    const lockValue = Math.random().toString(36);
    const lockAcquired = await redis.set(lockKey, lockValue, 'EX', 10, 'NX');
    
    if (lockAcquired) {
      try {
        // Fetch fresh data
        const fresh = await fetcher();
        const cacheData = {
          value: fresh,
          timestamp: Date.now(),
        };
        
        // Cache the result
        await redis.setex(key, ttl + staleTime, JSON.stringify(cacheData));
        timer.end({ cacheHit: false, fetched: true });
        logCacheOperation({ operation: 'set', key, ttl: ttl + staleTime, success: true });
        
        return fresh;
      } finally {
        // Release lock only if we still own it
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redis.eval(script, 1, lockKey, lockValue);
      }
    } else {
      // Wait briefly and retry if another process is fetching
      await new Promise(resolve => setTimeout(resolve, 100));
      const retryData = await redis.get(key);
      if (retryData) {
        timer.end({ cacheHit: true, retried: true });
        return JSON.parse(retryData).value as T;
      }
      
      // Fallback: fetch without caching
      const fresh = await fetcher();
      timer.end({ cacheHit: false, lockFailed: true });
      return fresh;
    }
  } catch (error) {
    timer.end({ error: true });
    logError({ error, context: 'cache_operation', additionalInfo: { key } });
    // Fallback to direct fetch on cache errors
    return await fetcher();
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  const timer = new Timer(`cache.invalidate.${pattern}`);
  try {
    // Use SCAN instead of KEYS to avoid blocking Redis
    const stream = redis.scanStream({
      match: pattern,
      count: 100,
    });

    const keysToDelete: string[] = [];
    
    stream.on('data', (keys: string[]) => {
      keysToDelete.push(...keys);
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', async () => {
        try {
          if (keysToDelete.length > 0) {
            // Delete in batches to avoid overwhelming Redis
            const batchSize = 100;
            for (let i = 0; i < keysToDelete.length; i += batchSize) {
              const batch = keysToDelete.slice(i, i + batchSize);
              await redis.del(...batch);
            }
            logCacheOperation({
              operation: 'invalidate',
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
      stream.on('error', reject);
    });
  } catch (error) {
    timer.end({ error: true });
    logError({ error, context: 'cache_invalidation', additionalInfo: { pattern } });
  }
}
