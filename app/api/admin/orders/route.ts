import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { getCachedData } from '@/lib/redis';

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

export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, 401);
  }

  try {
    // Use Redis cache for orders list
    const orders = await getCachedData(
      'admin:orders:all',
      60, // Cache for 1 minute (orders change more frequently)
      async () => {
        return await prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
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

    return apiSuccess({
      orders: orders.map(order => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map(item => ({
          ...item,
          product: {
            ...item.product,
            createdAt: item.product.createdAt.toISOString(),
            updatedAt: item.product.updatedAt.toISOString(),
          },
          variation: item.variation ? {
            ...item.variation,
            createdAt: item.variation.createdAt.toISOString(),
            updatedAt: item.variation.updatedAt.toISOString(),
          } : null,
        })),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
