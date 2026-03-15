import { drizzleDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { cacheAdminUsersList } from '@/lib/cache';

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
  
  return { authorized: true, userId: session.user.id };
}

export async function GET() {
  try {
    const authCheck = await checkAdminAuth();
    if (!authCheck.authorized) {
      return apiError(authCheck.error ?? 'Unknown error', authCheck.status);
    }

    const userList = await cacheAdminUsersList(() =>
      drizzleDb.query.users.findMany({
        orderBy: [desc(users.createdAt)],
        with: { orders: true },
      }).then((rows) =>
        rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          emailVerified: u.emailVerified,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          image: u.image,
          _count: { orders: u.orders.length },
        })),
      ),
    );

    return apiSuccess({ users: userList });
  } catch (error) {
    return handleApiError(error);
  }
}
