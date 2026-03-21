import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { drizzleDb } from "@/lib/db";
import { categories } from "@/lib/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { z } from "zod/v4";

const UpdateCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const PUT = async (request: Request, { params }: RouteParams) => {
  const session = await auth();
  if (!session?.user) return apiError("Not authenticated", 401);
  if (session.user.role !== "ADMIN") return apiError("Not authorized", 403);

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = UpdateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    const existing = await drizzleDb
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      return apiError("Category not found", 404);
    }

    const { name, sortOrder } = parsed.data;

    // Check name uniqueness if changing name
    if (name && name.trim() !== existing[0].name) {
      const duplicate = await drizzleDb
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.name, name.trim()),
            ne(categories.id, id),
            isNull(categories.deletedAt),
          ),
        )
        .limit(1);

      if (duplicate.length > 0) {
        return apiError("A category with this name already exists", 409);
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const [updated] = await drizzleDb
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();

    return apiSuccess({
      category: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        deletedAt: updated.deletedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const DELETE = async (_request: Request, { params }: RouteParams) => {
  const session = await auth();
  if (!session?.user) return apiError("Not authenticated", 401);
  if (session.user.role !== "ADMIN") return apiError("Not authorized", 403);

  const { id } = await params;

  try {
    const existing = await drizzleDb
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      return apiError("Category not found", 404);
    }

    await drizzleDb
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(categories.id, id));

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
};
