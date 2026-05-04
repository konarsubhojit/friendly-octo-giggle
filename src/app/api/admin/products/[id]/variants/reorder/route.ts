import { NextRequest } from 'next/server'
import { primaryDrizzleDb as drizzleDb } from '@/lib/db'
import { productVariants } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { ReorderVariantsSchema } from '@/features/product/validations'
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { invalidateProductCaches } from '@/lib/cache'
import { revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id: productId } = await params
    const body = await request.json()
    const parseResult = ReorderVariantsSchema.safeParse(body)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }

    const { items } = parseResult.data
    const now = new Date()

    await drizzleDb.transaction(async (tx) => {
      await Promise.all(
        items.map(({ id, sortOrder }) =>
          tx
            .update(productVariants)
            .set({ sortOrder, updatedAt: now })
            .where(eq(productVariants.id, id))
        )
      )
    })

    revalidateTag('products', {})
    await invalidateProductCaches(productId)

    return apiSuccess({ reordered: true })
  } catch (error) {
    return handleApiError(error)
  }
}
