import { NextRequest } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
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
  
  if (!session?.user) {
    return { authorized: false, error: 'Not authenticated', status: 401 as const };
  }
  
  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: 'Not authorized - Admin access required', status: 403 as const };
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
      return apiError(authCheck.error ?? 'Unauthorized', authCheck.status);
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
    const [user] = await drizzleDb.update(users)
      .set({ role: validated.role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        image: users.image,
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
      return apiError(authCheck.error ?? 'Unauthorized', authCheck.status);
    }

    const { id } = await params;

    // Use Redis cache for individual user
    const user = await getCachedData(
      `admin:user:${id}`,
      300, // Cache for 5 minutes
      async () => {
        const user = await drizzleDb.query.users.findFirst({
          where: eq(users.id, id),
          with: { orders: true, sessions: true },
        });
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          image: user.image,
          _count: { orders: user.orders.length, sessions: user.sessions.length },
        };
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
