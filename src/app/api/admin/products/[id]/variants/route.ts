import { NextRequest } from 'next/server'
import { drizzleDb } from '@/lib/db'
import {
  products,
  productVariants,
  productVariantOptionValues,
} from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { CreateVariantSchema } from '@/features/product/validations'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { invalidateProductCaches } from '@/lib/cache'
import { serializeVariant } from '@/lib/serializers'

const MAX_VARIANTS_PER_PRODUCT = 25

const findProduct = (productId: string) =>
  drizzleDb.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth('products:read')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params
    const product = await findProduct(id)
    if (!product) {
      return apiError('Product not found', 404)
    }

    const variants = await drizzleDb.query.productVariants.findMany({
      where: and(
        eq(productVariants.productId, id),
        isNull(productVariants.deletedAt)
      ),
      with: {
        optionValues: {
          with: {
            optionValue: true,
          },
        },
      },
    })

    const serialized = variants.map(serializeVariant)

    return apiSuccess({ variants: serialized, count: serialized.length })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params
    const product = await findProduct(id)
    if (!product) {
      return apiError('Product not found', 404)
    }

    const { optionValueIds, ...validated } = await parseJsonBody(
      request,
      CreateVariantSchema
    )

    const activeCount = await drizzleDb.query.productVariants.findMany({
      where: and(
        eq(productVariants.productId, id),
        isNull(productVariants.deletedAt)
      ),
      columns: { id: true },
    })
    if (activeCount.length >= MAX_VARIANTS_PER_PRODUCT) {
      return apiError('Maximum of 25 variants per product reached', 400)
    }

    const [variant] = await drizzleDb
      .insert(productVariants)
      .values({
        productId: id,
        sku: validated.sku ?? null,
        price: validated.price,
        stock: validated.stock,
        weightGrams: validated.weightGrams ?? null,
        image: validated.image ?? null,
        images: validated.images ?? [],
        sortOrder: activeCount.length,
      })
      .returning()

    if (optionValueIds && optionValueIds.length > 0) {
      await drizzleDb.insert(productVariantOptionValues).values(
        optionValueIds.map((optionValueId) => ({
          variantId: variant.id,
          optionValueId,
        }))
      )
    }

    await invalidateProductCaches(id)

    await recordAdminAuditLog({
      userId: authCheck.userId,
      role: authCheck.role,
      entity: 'variant',
      entityId: variant.id,
      action: 'create',
      diff: { productId: id, ...validated, optionValueIds: optionValueIds ?? [] },
    })

    return apiSuccess({ variant: serializeVariant(variant) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
