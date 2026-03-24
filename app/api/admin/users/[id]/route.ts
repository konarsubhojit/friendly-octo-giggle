import { NextRequest } from "next/server";
import { primaryDrizzleDb as drizzleDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkAdminAuth } from "@/lib/admin-auth";
import { cacheAdminUserById, invalidateAdminUserCaches } from "@/lib/cache";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "CUSTOMER"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCheck = await checkAdminAuth();
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

    const { id } = await params;
    const body = await request.json();

    const validated = UpdateUserRoleSchema.parse(body);

    if (id === authCheck.userId) {
      return apiError("Cannot modify your own role", 403);
    }

    const [user] = await drizzleDb
      .update(users)
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

    await invalidateAdminUserCaches(id);

    return apiSuccess({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCheck = await checkAdminAuth();
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
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
        _count: {
          orders: found.orders.length,
          sessions: found.sessions.length,
        },
      };
    });

    if (!user) {
      return apiError("User not found", 404);
    }

    return apiSuccess({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
