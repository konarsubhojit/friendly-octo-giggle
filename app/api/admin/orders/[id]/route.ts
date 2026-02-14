import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { OrderStatus } from '@/lib/types';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { getCachedData, invalidateCache } from '@/lib/redis';
import { serializeOrder } from '@/lib/serializers';

export const dynamic = 'force-dynamic';

// Check if user is admin
async function checkAdminAuth() {
  const session = await auth();
  
  if (!session || !session.user) {
    return { authorized: false, error: 'Not authenticated' };
  }
  
  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: 'Not authorized - Admin access required' };
  }
  
  return { authorized: true };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, 401);
  }

  try {
    const { id } = await params;
    const body: { status: OrderStatus } = await request.json();
    
    if (!body.status || !Object.values(OrderStatus).includes(body.status)) {
      return apiError('Invalid status', 400);
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status: body.status },
      include: {
        items: {
          include: {
            product: true,
            variation: true,
          },
        },
      },
    });

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
    return apiError(authCheck.error!, 401);
  }

  try {
    const { id } = await params;
    
    // Use Redis cache for individual order
    const order = await getCachedData(
      `admin:order:${id}`,
      60, // Cache for 1 minute
      async () => {
        return await prisma.order.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: true,
                variation: true,
              },
            },
          },
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
