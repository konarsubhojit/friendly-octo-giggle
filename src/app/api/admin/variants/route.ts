import { NextRequest } from 'next/server'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import {
  products,
  productVariants,
  productVariantOptionValues,
} from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { CreateVariantSchema } from '@/features/product/validations'
import { z } from 'zod'
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

const MAX_VARIANTS_PER_PRODUCT = 25

const CreateAdminVariantSchema = CreateVariantSchema.extend({
  productId: z.string().min(1, 'Product id is required'),
})

const findProduct = (productId: string) =>
  drizzleDb.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  })

export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const body = await request.json()
    const parseResult = CreateAdminVariantSchema.safeParse(body)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }

    const { productId, optionValueIds, ...validated } = parseResult.data
    const product = await findProduct(productId)
    if (!product) {
      return apiError('Product not found', 404)
    }

    let variant
    try {
      variant = await primaryDrizzleDb.transaction(async (tx) => {
        const activeCount = await tx.query.productVariants.findMany({
          where: and(
            eq(productVariants.productId, productId),
            isNull(productVariants.deletedAt)
          ),
          columns: { id: true },
        })
        if (activeCount.length >= MAX_VARIANTS_PER_PRODUCT) {
          throw new Error('Maximum of 25 variants per product reached')
        }

        const [newVariant] = await tx
          .insert(productVariants)
          .values({
            productId,
            sku: validated.sku ?? null,
            price: validated.price,
            stock: validated.stock,
            image: validated.image ?? null,
            images: validated.images ?? [],
          })
          .returning()

        if (optionValueIds && optionValueIds.length > 0) {
          await tx.insert(productVariantOptionValues).values(
            optionValueIds.map((optionValueId) => ({
              variantId: newVariant.id,
              optionValueId,
            }))
          )
        }

        return newVariant
      })
    } catch (txError) {
      if (
        txError instanceof Error &&
        txError.message === 'Maximum of 25 variants per product reached'
      ) {
        return apiError('Maximum of 25 variants per product reached', 400)
      }
      throw txError
    }

    revalidateTag('products', {})
    await invalidateProductCaches(productId)

    return apiSuccess({ variant: serializeVariant(variant) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
