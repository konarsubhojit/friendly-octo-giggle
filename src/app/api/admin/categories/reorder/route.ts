import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { auth } from '@/lib/auth'
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
  const session = await auth()
  if (!session?.user) return apiError('Not authenticated', 401)
  if (session.user.role !== 'ADMIN') return apiError('Not authorized', 403)

  try {
    const parsed = await parseJsonBody(request, ReorderCategoriesSchema)

    await primaryDrizzleDb.transaction(async (tx) => {
      await Promise.all(
        parsed.items.map(({ id, sortOrder }) =>
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
