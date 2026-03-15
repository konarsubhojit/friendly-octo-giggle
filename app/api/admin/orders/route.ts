import { drizzleDb } from '@/lib/db';
import { orders } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { cacheAdminOrdersList } from '@/lib/cache';
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

export async function GET() {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ? authCheck.error : 'Unknown error', authCheck.status);
  }

  try {
    const orderList = await cacheAdminOrdersList(() =>
      drizzleDb.query.orders.findMany({
        orderBy: [desc(orders.createdAt)],
        with: { items: { with: { product: true, variation: true } } },
      }),
    );

    return apiSuccess({
      orders: serializeOrders(orderList),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
