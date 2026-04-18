import { NextRequest } from 'next/server'
import { primaryDrizzleDb, drizzleDb } from '@/lib/db'
import { productOptions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { invalidateProductCaches } from '@/lib/cache'
import { revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id, optionId } = await params

    const existing = await drizzleDb.query.productOptions.findFirst({
      where: eq(productOptions.id, optionId),
      columns: { id: true, productId: true },
    })
    if (!existing || existing.productId !== id) {
      return apiError('Option not found', 404)
    }

    await primaryDrizzleDb
      .delete(productOptions)
      .where(eq(productOptions.id, optionId))

    revalidateTag('products', {})
    await invalidateProductCaches(id)

    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
