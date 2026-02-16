import { NextRequest } from 'next/server';
import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { getCachedData } from '@/lib/redis';
import { serializeOrders } from '@/lib/serializers';

export const dynamic = 'force-dynamic';

// Check if user is admin
async function checkAdminAuth() {
  const session = await auth();
  
  if (!session?.user) {
    return { authorized: false, error: 'Not authenticated', status: 401 as const };
  }
  
  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: 'Not authorized - Admin access required', status: 403 as const };
  }
  
  return { authorized: true };
}

export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    // Use Redis cache for orders list
    const orders = await getCachedData(
      'admin:orders:all',
      60, // Cache for 1 minute (orders change more frequently)
      async () => {
        return await drizzleDb.query.orders.findMany({
          orderBy: [desc(schema.orders.createdAt)],
          with: { items: { with: { product: true, variation: true } } },
        });
      },
      10 // Stale time
    );

    return apiSuccess({
      orders: serializeOrders(orders),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
