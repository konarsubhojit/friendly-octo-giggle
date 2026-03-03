import { NextRequest } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, handleApiError, handleValidationError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { getCachedData, invalidateCache } from '@/lib/redis';
import { serializeOrder } from '@/lib/serializers';
import { UpdateOrderStatusSchema } from '@/lib/validations';

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
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status);
  }

  try {
    const { id } = await params;
    const rawBody = await request.json();

    // Validate with Zod schema
    const parseResult = UpdateOrderStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }
    const { status, trackingNumber, shippingProvider } = parseResult.data;

    const fieldUpdates: Record<string, unknown> = { trackingNumber, shippingProvider };
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
      ...Object.fromEntries(
        Object.entries(fieldUpdates).filter(([, value]) => value !== undefined)
      ),
    };

    await drizzleDb.update(orders)
      .set(updateData)
      .where(eq(orders.id, id));

    const order = await drizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: { with: { product: true, variation: true } } },
    });

    if (!order) {
      return apiError('Order not found', 404);
    }

    // Invalidate order caches (list + individual)
    await invalidateCache('admin:orders:*');
    await invalidateCache(`admin:order:${id}`);

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
    return apiError(authCheck.error ?? 'Unknown error', authCheck.status);
  }

  try {
    const { id } = await params;
    
    // Use Redis cache for individual order
    const order = await getCachedData(
      `admin:order:${id}`,
      60, // Cache for 1 minute
      async () => {
        return await drizzleDb.query.orders.findFirst({
          where: eq(orders.id, id),
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
