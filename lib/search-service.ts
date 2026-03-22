/**
 * Search service with Upstash → DB fallback.
 *
 * Returns matching IDs when Upstash Search is available and succeeds.
 * Returns null when Upstash is unavailable or fails, signaling the
 * caller to fall back to database search.
 */

import { isSearchAvailable, searchProducts } from "./search";
import { logError } from "./logger";
import { getCachedData } from "./redis";

const PRODUCT_SEARCH_TTL_SECONDS = 60;
const PRODUCT_SEARCH_STALE_SECONDS = 10;

const buildProductSearchCacheKey = (
  query: string,
  options?: { limit?: number; category?: string },
) => {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCategory = options?.category?.trim().toLowerCase() ?? "all";
  return `search:products:${encodeURIComponent(normalizedQuery)}:${encodeURIComponent(normalizedCategory)}:${options?.limit ?? 20}`;
};

/**
 * Search products via Upstash. Returns IDs on success, null for DB fallback.
 */
export async function searchProductIds(
  query: string,
  options?: { limit?: number; category?: string },
): Promise<string[] | null> {
  if (!isSearchAvailable()) return null;

  try {
    const results = await searchProducts(query, options);
    return results.map((r) => r.id);
  } catch (error) {
    logError({
      error,
      context: "search-service",
      additionalInfo: { operation: "searchProductIds", query },
    });
    return null;
  }
}

export async function searchProductIdsCached(
  query: string,
  options?: { limit?: number; category?: string },
): Promise<string[] | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  if (!isSearchAvailable()) {
    return null;
  }

  return getCachedData(
    buildProductSearchCacheKey(normalizedQuery, options),
    PRODUCT_SEARCH_TTL_SECONDS,
    () => searchProductIds(normalizedQuery, options),
    PRODUCT_SEARCH_STALE_SECONDS,
  );
}
