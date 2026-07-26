import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { primaryDrizzleDb } from '@/lib/db'
import { categories } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const ReorderCategoriesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1, 'At least one item required'),
})

export const PATCH = async (request: Request) => {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const validated = await parseJsonBody(request, ReorderCategoriesSchema)

    await primaryDrizzleDb.transaction(async (tx) => {
      await Promise.all(
        validated.items.map(({ id, sortOrder }) =>
          tx
            .update(categories)
            .set({ sortOrder, updatedAt: new Date() })
            .where(eq(categories.id, id))
        )
      )
    })

    return apiSuccess({ reordered: true })
  } catch (error) {
    return handleApiError(error)
  }
}
