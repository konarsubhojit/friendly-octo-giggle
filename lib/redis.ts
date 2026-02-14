import Redis from 'ioredis';

// Singleton Redis connection for serverless
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
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
  
  try {
    // Try to get cached data
    const cached = await redis.get(key);
    
    if (cached) {
      const data = JSON.parse(cached) as { value: T; timestamp: number };
      const age = Date.now() - data.timestamp;
      
      // If data is fresh, return it
      if (age < ttl * 1000) {
        return data.value;
      }
      
      // If data is stale but within stale-while-revalidate window
      if (age < (ttl + staleTime) * 1000) {
        // Return stale data immediately
        const staleData = data.value;
        
        // Trigger background revalidation (non-blocking)
        setImmediate(async () => {
          try {
            const fresh = await fetcher();
            const cacheData = {
              value: fresh,
              timestamp: Date.now(),
            };
            await redis.setex(key, ttl + staleTime, JSON.stringify(cacheData));
          } catch (error) {
            console.error('Background revalidation failed:', error);
          }
        });
        
        return staleData;
      }
    }
    
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
        return JSON.parse(retryData).value as T;
      }
      
      // Fallback: fetch without caching
      return await fetcher();
    }
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to direct fetch on cache errors
    return await fetcher();
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}
