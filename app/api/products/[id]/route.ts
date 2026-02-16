import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCachedData } from '@/lib/redis';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Use Redis cache with stampede prevention
    const product = await getCachedData(
      `product:${id}`,
      60,
      async () => {
        return await db.products.findById(id);
      },
      10
    );

    if (!product) {
      return apiError('Product not found', 404);
    }

    return apiSuccess({ product });
  } catch (error) {
    return handleApiError(error);
  }
}
