/**
 * Search service with Upstash → DB fallback.
 *
 * Returns matching IDs when Upstash Search is available and succeeds.
 * Returns null when Upstash is unavailable or fails, signaling the
 * caller to fall back to database search.
 */

import { isSearchAvailable, searchProducts } from "./search";
import { logError } from "./logger";

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
