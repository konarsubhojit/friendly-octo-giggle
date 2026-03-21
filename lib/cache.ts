/**
 * Cache helpers for all resources
 *
 * This module provides specialized caching functions wrapping
 * the generic Redis cache utilities with resource-specific logic.
 */

import {
  getCachedData,
  invalidateCache as invalidateCachePattern,
  getRedisClient,
} from "./redis";
import { logCacheOperation, logError } from "./logger";

// Cache key patterns
export const CACHE_KEYS = {
  // Products
  PRODUCTS_ALL: "products:all",
  PRODUCTS_BESTSELLERS: "products:bestsellers",
  PRODUCT_BY_ID: (id: string) => `product:${id}`,
  PRODUCTS_PATTERN: "products:*",
  PRODUCT_PATTERN: "product:*",
  // Cart (per-user or per-session)
  CART_BY_USER: (userId: string) => `cart:user:${userId}`,
  CART_BY_SESSION: (sessionId: string) => `cart:session:${sessionId}`,
  CART_PATTERN: "cart:*",
  // User orders
  ORDERS_BY_USER: (userId: string) => `orders:user:${userId}`,
  ORDER_BY_ID: (userId: string, orderId: string) =>
    `order:${userId}:${orderId}`,
  ORDERS_USER_PATTERN: (userId: string) => `orders:user:${userId}`,
  ORDER_USER_PATTERN: (userId: string) => `order:${userId}:*`,
  // Admin products
  ADMIN_PRODUCTS_ALL: "admin:products:all",
  ADMIN_PRODUCTS_PATTERN: "admin:products:*",
  // Admin orders
  ADMIN_ORDERS_ALL: "admin:orders:all",
  ADMIN_ORDER_BY_ID: (id: string) => `admin:order:${id}`,
  ADMIN_ORDERS_PATTERN: "admin:orders:*",
  ADMIN_ORDER_PATTERN: "admin:order:*",
  // Admin users
  ADMIN_USERS_ALL: "admin:users:all",
  ADMIN_USER_BY_ID: (id: string) => `admin:user:${id}`,
  ADMIN_USERS_PATTERN: "admin:users:*",
  ADMIN_USER_PATTERN: "admin:user:*",
  // Admin sales
  ADMIN_SALES: "admin:sales:summary",
  ADMIN_SALES_PATTERN: "admin:sales:*",
  // Exchange rates (date-scoped, refreshed once per UTC day)
  EXCHANGE_RATES_BY_DATE: (date: string) => `exchange-rates:${date}`,
  // Product shares (immutable token → productId + variationId mapping)
  SHARE_RESOLVE_BY_KEY: (key: string) => `share:${key}`,
} as const;

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  PRODUCTS_LIST: 60, // 1 minute for product lists
  PRODUCTS_BESTSELLERS: 120, // 2 minutes for bestsellers (rankings change with new orders)
  PRODUCTS_BESTSELLERS_STALE: 20,
  PRODUCT_DETAIL: 300, // 5 minutes for individual products
  STALE_TIME: 10, // Extra time to serve stale data while revalidating
  CART: 30, // 30 seconds for cart (frequently mutated)
  CART_STALE: 5,
  USER_ORDERS: 60, // 1 minute for user orders
  USER_ORDERS_STALE: 10,
  ORDER_DETAIL: 120, // 2 minutes for individual order detail
  ORDER_DETAIL_STALE: 10,
  ADMIN_PRODUCTS: 60,
  ADMIN_PRODUCTS_STALE: 10,
  ADMIN_ORDERS: 60, // 1 minute for admin orders list
  ADMIN_ORDERS_STALE: 10,
  ADMIN_ORDER_DETAIL: 60, // 1 minute for individual admin order
  ADMIN_ORDER_DETAIL_STALE: 10,
  ADMIN_USERS: 300, // 5 minutes for admin users list
  ADMIN_USERS_STALE: 30,
  ADMIN_USER_DETAIL: 300, // 5 minutes for individual admin user
  ADMIN_USER_DETAIL_STALE: 30,
  ADMIN_SALES: 120, // 2 minutes for sales summary
  ADMIN_SALES_STALE: 30,
  // Share resolution: immutable once created — cache for 1 year with no stale window
  SHARE_RESOLVE: 31536000, // 1 year in seconds
} as const;

export const cacheProductsList = <T>(fetcher: () => Promise<T>): Promise<T> =>
  getCachedData(
    CACHE_KEYS.PRODUCTS_ALL,
    CACHE_TTL.PRODUCTS_LIST,
    fetcher,
    CACHE_TTL.STALE_TIME,
  );

export const cacheProductById = <T>(
  id: string,
  fetcher: () => Promise<T>,
): Promise<T> =>
  getCachedData(
    CACHE_KEYS.PRODUCT_BY_ID(id),
    CACHE_TTL.PRODUCT_DETAIL,
    fetcher,
    CACHE_TTL.STALE_TIME,
  );

/**
 * Cache bestsellers product list with stampede prevention
 * Uses a separate key from products:all so it can be independently refreshed
 */
export const cacheProductsBestsellers = <T>(
  fetcher: () => Promise<T>,
): Promise<T> => {
  return getCachedData(
    CACHE_KEYS.PRODUCTS_BESTSELLERS,
    CACHE_TTL.PRODUCTS_BESTSELLERS,
    fetcher,
    CACHE_TTL.PRODUCTS_BESTSELLERS_STALE,
  );
};

export const invalidateProductCaches = async (
  productId?: string,
): Promise<void> => {
  try {
    await invalidateCachePattern(CACHE_KEYS.PRODUCTS_PATTERN);
    await invalidateCachePattern(CACHE_KEYS.ADMIN_PRODUCTS_PATTERN);

    if (productId) {
      await invalidateCachePattern(CACHE_KEYS.PRODUCT_BY_ID(productId));
    }

    logCacheOperation({
      operation: "invalidate",
      key: productId ? `products:* and product:${productId}` : "products:*",
      success: true,
    });
  } catch (error) {
    logError({ error, context: "cache_invalidation" });
  }
};

export const invalidateCartCache = async (
  userId?: string,
  sessionId?: string,
): Promise<void> => {
  try {
    if (userId) {
      await invalidateCachePattern(CACHE_KEYS.CART_BY_USER(userId));
    }
    if (sessionId) {
      await invalidateCachePattern(CACHE_KEYS.CART_BY_SESSION(sessionId));
    }
  } catch (error) {
    logError({ error, context: "cart_cache_invalidation" });
  }
};

export const invalidateUserOrderCaches = async (
  userId: string,
): Promise<void> => {
  try {
    await invalidateCachePattern(CACHE_KEYS.ORDERS_BY_USER(userId));
    await invalidateCachePattern(CACHE_KEYS.ORDER_USER_PATTERN(userId));
  } catch (error) {
    logError({ error, context: "order_cache_invalidation" });
  }
};

/**
 * Cache admin orders list with stampede prevention
 */
export const cacheAdminOrdersList = <T>(
  fetcher: () => Promise<T>,
): Promise<T> => {
  return getCachedData(
    CACHE_KEYS.ADMIN_ORDERS_ALL,
    CACHE_TTL.ADMIN_ORDERS,
    fetcher,
    CACHE_TTL.ADMIN_ORDERS_STALE,
  );
};

/**
 * Cache single admin order by ID with stampede prevention
 */
export const cacheAdminOrderById = <T>(
  id: string,
  fetcher: () => Promise<T>,
): Promise<T> => {
  return getCachedData(
    CACHE_KEYS.ADMIN_ORDER_BY_ID(id),
    CACHE_TTL.ADMIN_ORDER_DETAIL,
    fetcher,
    CACHE_TTL.ADMIN_ORDER_DETAIL_STALE,
  );
};

/**
 * Invalidate admin order-related caches
 * Called after order status updates
 */
export const invalidateAdminOrderCaches = async (
  orderId: string,
  userId?: string | null,
): Promise<void> => {
  try {
    await invalidateCachePattern(CACHE_KEYS.ADMIN_ORDERS_PATTERN);
    await invalidateCachePattern(CACHE_KEYS.ADMIN_ORDER_BY_ID(orderId));
    await invalidateCachePattern(CACHE_KEYS.PRODUCTS_BESTSELLERS);
    await invalidateCachePattern(CACHE_KEYS.ADMIN_SALES_PATTERN);
    if (userId) {
      await invalidateUserOrderCaches(userId);
    }
  } catch (error) {
    logError({ error, context: "admin_order_cache_invalidation" });
  }
};

/**
 * Cache admin users list with stampede prevention
 */
export const cacheAdminUsersList = <T>(
  fetcher: () => Promise<T>,
): Promise<T> => {
  return getCachedData(
    CACHE_KEYS.ADMIN_USERS_ALL,
    CACHE_TTL.ADMIN_USERS,
    fetcher,
    CACHE_TTL.ADMIN_USERS_STALE,
  );
};

/**
 * Cache single admin user by ID with stampede prevention
 */
export const cacheAdminUserById = <T>(
  id: string,
  fetcher: () => Promise<T>,
): Promise<T> => {
  return getCachedData(
    CACHE_KEYS.ADMIN_USER_BY_ID(id),
    CACHE_TTL.ADMIN_USER_DETAIL,
    fetcher,
    CACHE_TTL.ADMIN_USER_DETAIL_STALE,
  );
};

/**
 * Invalidate admin user-related caches (list + individual user)
 * Called after user role updates
 */
export const invalidateAdminUserCaches = async (
  userId: string,
): Promise<void> => {
  try {
    await invalidateCachePattern(CACHE_KEYS.ADMIN_USERS_PATTERN);
    await invalidateCachePattern(CACHE_KEYS.ADMIN_USER_BY_ID(userId));
  } catch (error) {
    logError({ error, context: "admin_user_cache_invalidation" });
  }
};

/**
 * Cache admin sales summary with stampede prevention
 */
export const cacheAdminSales = <T>(fetcher: () => Promise<T>): Promise<T> => {
  return getCachedData(
    CACHE_KEYS.ADMIN_SALES,
    CACHE_TTL.ADMIN_SALES,
    fetcher,
    CACHE_TTL.ADMIN_SALES_STALE,
  );
};

/**
 * Cache a resolved share key to its product/variation mapping.
 *
 * Share tokens are immutable — the key → productId+variationId mapping never
 * changes after creation. Non-null results are cached with a 1-year TTL (an
 * effective permanent cache for an immutable record). Null results (token does
 * not yet exist) are intentionally NOT cached to prevent cache-poisoning via
 * prefetching random keys and to allow the token to become resolvable later.
 */
export const cacheShareResolve = async <T>(
  key: string,
  fetcher: () => Promise<T | null>,
): Promise<T | null> => {
  const redisClient = getRedisClient();
  if (!redisClient) return fetcher();

  const cacheKey = CACHE_KEYS.SHARE_RESOLVE_BY_KEY(key);
  try {
    const cached = await redisClient.get<string>(cacheKey);
    if (cached !== null) {
      logCacheOperation({ operation: "hit", key: cacheKey, success: true });
      return JSON.parse(cached) as T;
    }

    logCacheOperation({ operation: "miss", key: cacheKey, success: true });
    const result = await fetcher();

    // Only cache found results — a null result means the token does not (yet)
    // exist in the database. Caching nulls with a 1-year TTL would permanently
    // break share links if that key is created later, or allow arbitrary keys
    // to be prefetched to poison the cache.
    if (result !== null) {
      await redisClient.setex(
        cacheKey,
        CACHE_TTL.SHARE_RESOLVE,
        JSON.stringify(result),
      );
      logCacheOperation({
        operation: "set",
        key: cacheKey,
        ttl: CACHE_TTL.SHARE_RESOLVE,
        success: true,
      });
    }

    return result;
  } catch (error) {
    logError({
      error,
      context: "share_cache_operation",
      additionalInfo: { key: cacheKey },
    });
    return fetcher();
  }
};
