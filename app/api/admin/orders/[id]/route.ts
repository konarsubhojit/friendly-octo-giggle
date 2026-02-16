import { NextRequest } from 'next/server';
import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { OrderStatus } from '@/lib/types';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { getCachedData, invalidateCache } from '@/lib/redis';
import { serializeOrder } from '@/lib/serializers';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    const { id } = await params;
    const body: { status: OrderStatus } = await request.json();
    
    if (!body.status || !Object.values(OrderStatus).includes(body.status)) {
      return apiError('Invalid status', 400);
    }

    await drizzleDb.update(schema.orders)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(schema.orders.id, id));

    const order = await drizzleDb.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      with: { items: { with: { product: true, variation: true } } },
    });

    if (!order) {
      return apiError('Order not found', 404);
    }

    // Invalidate order caches
    await invalidateCache('admin:orders:*');

    return apiSuccess({
      order: serializeOrder(order),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    const { id } = await params;
    
    // Use Redis cache for individual order
    const order = await getCachedData(
      `admin:order:${id}`,
      60, // Cache for 1 minute
      async () => {
        return await drizzleDb.query.orders.findFirst({
          where: eq(schema.orders.id, id),
          with: { items: { with: { product: true, variation: true } } },
        });
      },
      10 // Stale time
    );

    if (!order) {
      return apiError('Order not found', 404);
    }

    return apiSuccess({
      order: serializeOrder(order),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
