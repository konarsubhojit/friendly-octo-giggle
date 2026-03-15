import { db } from '@/lib/db';
import { apiSuccess, handleApiError } from '@/lib/api-utils';
import { withLogging } from '@/lib/api-middleware';
import { cacheProductsList } from '@/lib/cache';

async function handleGet() {
  try {
    const products = await cacheProductsList(() => db.products.findAll());

    const response = apiSuccess({ products });
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withLogging(handleGet);
