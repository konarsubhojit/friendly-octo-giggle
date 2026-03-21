import { NextRequest } from 'next/server';
import { changePasswordSchema } from '@/lib/validations';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import {
  hashPassword,
  verifyPassword,
  checkPasswordHistory,
  savePasswordToHistory,
} from '@/lib/password';
import { drizzleDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { logAuthEvent } from '@/lib/logger';

export const POST = async (request: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Authentication required', 401);
    }

    const body = await request.json();
    const parseResult = changePasswordSchema.safeParse(body);

    if (!parseResult.success) {
      const details = parseResult.error.issues.reduce(
        (acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>,
      );
      return apiError('Validation failed', 400, details);
    }

    const { currentPassword, newPassword } = parseResult.data;

    const user = await drizzleDb.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user?.passwordHash) {
      return apiError('Password change not available for this account', 400);
    }

    const isCurrentValid = await verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      return apiError('Current password is incorrect', 400);
    }

    // Check if password was recently used
    const wasRecentlyUsed = await checkPasswordHistory(
      session.user.id,
      newPassword,
    );
    if (wasRecentlyUsed) {
      return apiError(
        'New password must be different from your last 2 passwords',
        400,
      );
    }

    const newHash = await hashPassword(newPassword);

    await drizzleDb
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    await savePasswordToHistory(session.user.id, newHash);

    logAuthEvent({
      event: 'password_change',
      userId: session.user.id,
      email: user.email,
      success: true,
    });

    return apiSuccess({ message: 'Password changed successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
