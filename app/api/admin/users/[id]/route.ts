import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { getCachedData, invalidateCache } from '@/lib/redis';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'CUSTOMER']),
});

// Check if user is admin
async function checkAdminAuth() {
  const session = await auth();
  
  if (!session || !session.user) {
    return { authorized: false, error: 'Not authenticated' };
  }
  
  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: 'Not authorized - Admin access required' };
  }
  
  return { authorized: true, userId: session.user.id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkAdminAuth();
    if (!authCheck.authorized) {
      return apiError(authCheck.error!, 401);
    }

    const { id } = await params;
    const body = await request.json();
    
    // Validate input
    const validated = UpdateUserRoleSchema.parse(body);

    // Prevent users from changing their own role
    if (id === authCheck.userId) {
      return apiError('Cannot modify your own role', 403);
    }

    // Update user role
    const user = await prisma.user.update({
      where: { id },
      data: { role: validated.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        image: true,
      },
    });

    // Invalidate user caches
    await invalidateCache('admin:users:*');

    return apiSuccess({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkAdminAuth();
    if (!authCheck.authorized) {
      return apiError(authCheck.error!, 401);
    }

    const { id } = await params;

    // Use Redis cache for individual user
    const user = await getCachedData(
      `admin:user:${id}`,
      300, // Cache for 5 minutes
      async () => {
        return await prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
            image: true,
            _count: {
              select: {
                orders: true,
                sessions: true,
              },
            },
          },
        });
      },
      30 // Stale time
    );

    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
