import { NextRequest } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { cacheAdminUserById, invalidateAdminUserCaches } from '@/lib/cache';
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

    // Invalidate user caches (list + individual user)
    await invalidateAdminUserCaches(id);

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

    const user = await cacheAdminUserById(id, async () => {
      const found = await drizzleDb.query.users.findFirst({
        where: eq(users.id, id),
        with: { orders: true, sessions: true },
      });
      if (!found) return null;
      return {
        id: found.id,
        name: found.name,
        email: found.email,
        role: found.role,
        emailVerified: found.emailVerified,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
        image: found.image,
        _count: { orders: found.orders.length, sessions: found.sessions.length },
      };
    });

    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
