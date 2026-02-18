/**
 * Product-specific cache helpers
 *
 * This module provides specialized caching functions for products,
 * wrapping the generic Redis cache utilities with product-specific logic.
 */

import { getCachedData, invalidateCache as invalidateCachePattern } from './redis';
import { Product } from './types';
import { logCacheOperation } from './logger';

// Cache key patterns
export const CACHE_KEYS = {
  PRODUCTS_ALL: 'products:all',
  PRODUCT_BY_ID: (id: string) => `product:${id}`,
  PRODUCTS_PATTERN: 'products:*',
  PRODUCT_PATTERN: 'product:*',
} as const;

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  PRODUCTS_LIST: 60, // 1 minute for product lists
  PRODUCT_DETAIL: 300, // 5 minutes for individual products
  STALE_TIME: 10, // Extra time to serve stale data while revalidating
} as const;

/**
 * Cache products list with stampede prevention
 */
export async function cacheProductsList<T>(
  fetcher: () => Promise<T>
): Promise<T> {
  return getCachedData(
    CACHE_KEYS.PRODUCTS_ALL,
    CACHE_TTL.PRODUCTS_LIST,
    fetcher,
    CACHE_TTL.STALE_TIME
  );
}

/**
 * Cache single product by ID with stampede prevention
 */
export async function cacheProductById<T>(
  id: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return getCachedData(
    CACHE_KEYS.PRODUCT_BY_ID(id),
    CACHE_TTL.PRODUCT_DETAIL,
    fetcher,
    CACHE_TTL.STALE_TIME
  );
}

/**
 * Invalidate all product-related caches
 * Called after product create/update/delete operations
 */
export async function invalidateProductCaches(productId?: string): Promise<void> {
  try {
    // Always invalidate the products list cache
    await invalidateCachePattern(CACHE_KEYS.PRODUCTS_PATTERN);

    // If a specific product ID is provided, also invalidate that product's cache
    if (productId) {
      await invalidateCachePattern(CACHE_KEYS.PRODUCT_BY_ID(productId));
    }

    logCacheOperation({
      operation: 'invalidate',
      key: productId ? `products:* and product:${productId}` : 'products:*',
      success: true,
    });
  } catch (error) {
    // Log error but don't throw - cache invalidation failure shouldn't break the app
    console.error('Failed to invalidate product caches:', error);
  }
}
