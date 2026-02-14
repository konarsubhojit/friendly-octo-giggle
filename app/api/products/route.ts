import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCachedData } from '@/lib/redis';
import { apiSuccess, handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    // Use Redis cache with stampede prevention
    const products = await getCachedData(
      'products:all',
      60, // Cache for 60 seconds
      async () => {
        return await db.products.findAll();
      },
      10 // Serve stale data for up to 10 extra seconds while revalidating
    );

    const response = apiSuccess({ products });
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
