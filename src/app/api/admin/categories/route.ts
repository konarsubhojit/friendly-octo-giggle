import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { drizzleDb } from '@/lib/db'
import { categories } from '@/lib/schema'
import { isNull, asc, eq, max } from 'drizzle-orm'
import { z } from 'zod/v4'
import { categoriesTag, revalidateCacheTags } from '@/lib/cache-tags'

const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
})

export async function GET() {
  const authCheck = await checkAdminAuth('products:read')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const list = await drizzleDb
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name))

    return apiSuccess(
      {
        categories: list.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      },
      200,
      { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=10' }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { name } = await parseJsonBody(request, CreateCategorySchema)

    const existing = await drizzleDb
      .select()
      .from(categories)
      .where(eq(categories.name, name.trim()))
      .limit(1)

    // Auto-assign sortOrder = max + 1 so new items always appear at the end
    const [{ maxOrder }] = await drizzleDb
      .select({ maxOrder: max(categories.sortOrder) })
      .from(categories)
      .where(isNull(categories.deletedAt))

    const nextSortOrder = (maxOrder ?? -1) + 1

    if (existing.length > 0) {
      const cat = existing[0]
      if (cat.deletedAt) {
        const [reactivated] = await drizzleDb
          .update(categories)
          .set({
            deletedAt: null,
            updatedAt: new Date(),
            sortOrder: nextSortOrder,
          })
          .where(eq(categories.id, cat.id))
          .returning()

        revalidateCacheTags([categoriesTag()], 'admin_category_reactivate')

        return apiSuccess(
          {
            category: {
              ...reactivated,
              createdAt: reactivated.createdAt.toISOString(),
              updatedAt: reactivated.updatedAt.toISOString(),
              deletedAt: null,
            },
          },
          201
        )
      }
      return apiError('A category with this name already exists', 409)
    }

    const [created] = await drizzleDb
      .insert(categories)
      .values({ name: name.trim(), sortOrder: nextSortOrder })
      .returning()

    revalidateCacheTags([categoriesTag()], 'admin_category_create')

    return apiSuccess(
      {
        category: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          deletedAt: null,
        },
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
