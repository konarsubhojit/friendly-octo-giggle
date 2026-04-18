import { NextRequest } from 'next/server'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import {
  products,
  productVariants,
  productVariantOptionValues,
} from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { UpdateVariantSchema } from '@/features/product/validations'
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { invalidateProductCaches } from '@/lib/cache'
import { revalidateTag } from 'next/cache'
import { serializeVariant } from '@/lib/serializers'

export const dynamic = 'force-dynamic'

const findVariantById = (variantId: string) =>
  drizzleDb.query.productVariants.findFirst({
    where: and(
      eq(productVariants.id, variantId),
      isNull(productVariants.deletedAt)
    ),
  })

const findProduct = (productId: string) =>
  drizzleDb.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  })

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { variantId } = await params
    const existing = await findVariantById(variantId)
    if (!existing) {
      return apiError('Variant not found', 404)
    }

    const product = await findProduct(existing.productId)
    if (!product) {
      return apiError('Product not found', 404)
    }

    const body = await request.json()
    const parseResult = UpdateVariantSchema.safeParse(body)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }

    const { optionValueIds, ...validated } = parseResult.data
    if (Object.keys(validated).length === 0 && optionValueIds === undefined) {
      return apiError('No fields to update', 400)
    }

    const updateData: Record<string, unknown> = {
      ...validated,
      updatedAt: new Date(),
    }

    const [updated] = await primaryDrizzleDb.transaction(async (tx) => {
      const [updatedVariant] = await tx
        .update(productVariants)
        .set(updateData)
        .where(eq(productVariants.id, variantId))
        .returning()

      if (optionValueIds !== undefined) {
        await tx
          .delete(productVariantOptionValues)
          .where(eq(productVariantOptionValues.variantId, variantId))

        if (optionValueIds.length > 0) {
          await tx.insert(productVariantOptionValues).values(
            optionValueIds.map((optionValueId) => ({
              variantId,
              optionValueId,
            }))
          )
        }
      }

      return [updatedVariant]
    })

    revalidateTag('products', {})
    await invalidateProductCaches(existing.productId)

    return apiSuccess({ variant: serializeVariant(updated) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { variantId } = await params
    const existing = await findVariantById(variantId)
    if (!existing) {
      return apiError('Variant not found', 404)
    }

    const product = await findProduct(existing.productId)
    if (!product) {
      return apiError('Product not found', 404)
    }

    try {
      await primaryDrizzleDb.transaction(async (tx) => {
        const activeVariants = await tx.query.productVariants.findMany({
          where: and(
            eq(productVariants.productId, existing.productId),
            isNull(productVariants.deletedAt)
          ),
          columns: { id: true },
        })
        if (activeVariants.length <= 1) {
          throw new Error('Cannot delete the last variant of a product')
        }

        await tx
          .update(productVariants)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(productVariants.id, variantId))
      })
    } catch (txError) {
      if (
        txError instanceof Error &&
        txError.message === 'Cannot delete the last variant of a product'
      ) {
        return apiError('Cannot delete the last variant of a product', 400)
      }
      throw txError
    }

    revalidateTag('products', {})
    await invalidateProductCaches(existing.productId)

    return apiSuccess({
      message: 'Variant soft-deleted successfully',
      id: variantId,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
