import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { getCachedData } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Check if user is admin
async function checkAdminAuth(request: NextRequest) {
  const session = await auth();
  
  if (!session || !session.user) {
    return { authorized: false, error: 'Not authenticated' };
  }
  
  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: 'Not authorized - Admin access required' };
  }
  
  return { authorized: true, userId: session.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await checkAdminAuth(request);
    if (!authCheck.authorized) {
      return apiError(authCheck.error!, 401);
    }

    // Use Redis cache for user list
    const users = await getCachedData(
      'admin:users:all',
      300, // Cache for 5 minutes
      async () => {
        return await prisma.user.findMany({
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
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      },
      30 // Stale time
    );

    return apiSuccess({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
