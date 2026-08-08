import { NextRequest } from 'next/server'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import {
  products,
  productVariants,
  productVariantOptionValues,
} from '@/lib/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { UpdateVariantSchema } from '@/features/product/validations'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { invalidateProductCaches } from '@/lib/cache'
import { serializeVariant } from '@/lib/serializers'

class VariantGoneError extends Error {
  constructor() {
    super('Variant is no longer available')
    this.name = 'VariantGoneError'
  }
}

class ReservedStockError extends Error {
  constructor(readonly reservedStock: number) {
    super('Stock cannot be set below the units currently reserved')
    this.name = 'ReservedStockError'
  }
}

class LastVariantError extends Error {
  constructor() {
    super('Cannot delete the last variant of a product')
    this.name = 'LastVariantError'
  }
}

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
  const authCheck = await checkAdminAuth('products:write')
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

    const { optionValueIds, ...validated } = await parseJsonBody(
      request,
      UpdateVariantSchema
    )
    if (Object.keys(validated).length === 0 && optionValueIds === undefined) {
      return apiError('No fields to update', 400)
    }

    const updateData: Record<string, unknown> = {
      ...validated,
      updatedAt: new Date(),
    }

    const [updated] = await primaryDrizzleDb.transaction(async (tx) => {
      // A stock correction must never fall below the units live checkout
      // requests are already holding: those shoppers have been promised them,
      // and the counter would then exceed on-hand stock and read as sold out.
      const stockFloor =
        validated.stock === undefined
          ? undefined
          : sql`${productVariants.reservedStock} <= ${validated.stock}`

      const [updatedVariant] = await tx
        .update(productVariants)
        .set(updateData)
        .where(
          and(
            eq(productVariants.id, variantId),
            isNull(productVariants.deletedAt),
            stockFloor
          )
        )
        .returning()

      if (!updatedVariant) {
        const [current] = await tx
          .select({ reservedStock: productVariants.reservedStock })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.id, variantId),
              isNull(productVariants.deletedAt)
            )
          )

        if (
          current &&
          validated.stock !== undefined &&
          current.reservedStock > validated.stock
        ) {
          throw new ReservedStockError(current.reservedStock)
        }

        // Row was soft-deleted or removed between the initial find and this
        // UPDATE. Abort the transaction so we don't also mutate
        // productVariantOptionValues for a non-existent variant.
        throw new VariantGoneError()
      }

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

    await invalidateProductCaches(existing.productId)

    return apiSuccess({ variant: serializeVariant(updated) })
  } catch (error) {
    if (error instanceof ReservedStockError) {
      return apiError(
        `Stock cannot be set below the ${error.reservedStock} unit(s) currently reserved by open checkout requests`,
        409
      )
    }
    if (error instanceof VariantGoneError) {
      return apiError('Variant not found', 404)
    }
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const authCheck = await checkAdminAuth('products:write')
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
        // Single conditional UPDATE: only succeeds when the product still has
        // more than one active variant AND this variant is still active.
        // The correlated subquery makes the check+delete atomic — no race
        // condition even under concurrent deletes — while staying within
        // Drizzle's query builder (not tx.execute) so it works on Neon's
        // serverless HTTP driver. Timestamps use NOW() to keep the source of
        // truth on the database side.
        const [deleted] = await tx
          .update(productVariants)
          .set({ deletedAt: sql`NOW()`, updatedAt: sql`NOW()` })
          .where(
            and(
              eq(productVariants.id, variantId),
              isNull(productVariants.deletedAt),
              sql`(SELECT COUNT(*) FROM ${productVariants} WHERE ${productVariants.productId} = ${existing.productId} AND ${productVariants.deletedAt} IS NULL) > 1`
            )
          )
          .returning({ id: productVariants.id })

        if (!deleted) {
          // The UPDATE matched nothing. Determine why: either this was the
          // last active variant (still present but blocked) or it was already
          // soft-deleted by a concurrent request.
          const remaining = await tx.query.productVariants.findMany({
            where: and(
              eq(productVariants.productId, existing.productId),
              isNull(productVariants.deletedAt)
            ),
            columns: { id: true },
          })
          if (remaining.some((v) => v.id === variantId)) {
            throw new LastVariantError()
          }
          throw new VariantGoneError()
        }
      })
    } catch (txError) {
      if (txError instanceof LastVariantError) {
        return apiError('Cannot delete the last variant of a product', 400)
      }
      if (txError instanceof VariantGoneError) {
        return apiError('Variant not found', 404)
      }
      throw txError
    }

    await invalidateProductCaches(existing.productId)

    return apiSuccess({
      message: 'Variant soft-deleted successfully',
      id: variantId,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
