import { db } from '@/lib/db';
import { apiSuccess, handleApiError } from '@/lib/api-utils';
import { withLogging } from '@/lib/api-middleware';

/**
 * GET /api/products/bestsellers
 *
 * Returns all products sorted by total units sold (from non-cancelled orders),
 * descending. Products with no sales appear at the end ordered by creation date.
 * Results are Redis-cached for 2 minutes with a 20-second stale window.
 */
async function handleGet() {
  try {
    const products = await db.products.findBestsellers({ withCache: true });

    const response = apiSuccess({ products });
    response.headers.set('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withLogging(handleGet);
