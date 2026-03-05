/**
 * Cache helpers for all resources
 *
 * This module provides specialized caching functions wrapping
 * the generic Redis cache utilities with resource-specific logic.
 */

import {
  getCachedData,
  invalidateCache as invalidateCachePattern,
} from "./redis";
import { logCacheOperation, logError } from "./logger";

// Cache key patterns
export const CACHE_KEYS = {
  // Products
  PRODUCTS_ALL: "products:all",
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
} as const;

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  PRODUCTS_LIST: 60, // 1 minute for product lists
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
} as const;

/**
 * Cache products list with stampede prevention
 */
export function cacheProductsList<T>(fetcher: () => Promise<T>): Promise<T> {
  return getCachedData(
    CACHE_KEYS.PRODUCTS_ALL,
    CACHE_TTL.PRODUCTS_LIST,
    fetcher,
    CACHE_TTL.STALE_TIME,
  );
}

/**
 * Cache single product by ID with stampede prevention
 */
export function cacheProductById<T>(
  id: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  return getCachedData(
    CACHE_KEYS.PRODUCT_BY_ID(id),
    CACHE_TTL.PRODUCT_DETAIL,
    fetcher,
    CACHE_TTL.STALE_TIME,
  );
}

/**
 * Invalidate all product-related caches (public + admin)
 * Called after product create/update/delete operations
 */
export async function invalidateProductCaches(
  productId?: string,
): Promise<void> {
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
}

/**
 * Invalidate cart cache for a specific user or session
 */
export async function invalidateCartCache(
  userId?: string,
  sessionId?: string,
): Promise<void> {
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
}

/**
 * Invalidate order caches for a specific user
 */
export async function invalidateUserOrderCaches(userId: string): Promise<void> {
  try {
    await invalidateCachePattern(CACHE_KEYS.ORDERS_BY_USER(userId));
    await invalidateCachePattern(CACHE_KEYS.ORDER_USER_PATTERN(userId));
  } catch (error) {
    logError({ error, context: "order_cache_invalidation" });
  }
}
