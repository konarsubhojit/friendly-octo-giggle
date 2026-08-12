import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { drizzleDb } from '@/lib/db'
import { categories } from '@/lib/schema'
import { eq, and, isNull, ne } from 'drizzle-orm'
import { z } from 'zod/v4'
import { categoriesTag, revalidateCacheTags } from '@/lib/cache-tags'

const UpdateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  const { id } = await params

  try {
    const validated = await parseJsonBody(request, UpdateCategorySchema)

    const existing = await drizzleDb
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .limit(1)

    if (existing.length === 0) {
      return apiError('Category not found', 404)
    }

    const { name, sortOrder } = validated

    if (name && name.trim() !== existing[0].name) {
      const duplicate = await drizzleDb
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.name, name.trim()),
            ne(categories.id, id),
            isNull(categories.deletedAt)
          )
        )
        .limit(1)

      if (duplicate.length > 0) {
        return apiError('A category with this name already exists', 409)
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (name !== undefined) updates.name = name.trim()
    if (sortOrder !== undefined) updates.sortOrder = sortOrder

    const [updated] = await drizzleDb
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning()

    revalidateCacheTags([categoriesTag()], 'admin_category_update')

    await recordAdminAuditLog({
      userId: authCheck.userId,
      role: authCheck.role,
      entity: 'category',
      entityId: id,
      action: 'update',
      diff: validated,
    })

    return apiSuccess({
      category: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        deletedAt: updated.deletedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  const { id } = await params

  try {
    const existing = await drizzleDb
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .limit(1)

    if (existing.length === 0) {
      return apiError('Category not found', 404)
    }

    await drizzleDb
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(categories.id, id))

    revalidateCacheTags([categoriesTag()], 'admin_category_delete')

    await recordAdminAuditLog({
      userId: authCheck.userId,
      role: authCheck.role,
      entity: 'category',
      entityId: id,
      action: 'delete',
    })

    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
