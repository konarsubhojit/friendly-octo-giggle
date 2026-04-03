import { NextRequest } from 'next/server'
import { drizzleDb } from '@/lib/db'
import { products, productVariations } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { CreateVariationSchema } from '@/features/product/validations'
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

const MAX_VARIATIONS_PER_PRODUCT = 25

const findProduct = (productId: string) =>
  drizzleDb.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  })

/**
 * GET /api/admin/products/[id]/variations
 * List all active (non-deleted) variations for a product
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params
    const product = await findProduct(id)
    if (!product) {
      return apiError('Product not found', 404)
    }

    const variations = await drizzleDb.query.productVariations.findMany({
      where: and(
        eq(productVariations.productId, id),
        isNull(productVariations.deletedAt)
      ),
    })

    const serialized = variations.map((v) => ({
      ...v,
      styleId: v.styleId ?? null,
      image: v.image ?? null,
      images: v.images ?? [],
      deletedAt: null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }))

    return apiSuccess({ variations: serialized, count: serialized.length })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/admin/products/[id]/variations
 * Create a new variation for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params
    const product = await findProduct(id)
    if (!product) {
      return apiError('Product not found', 404)
    }

    const body = await request.json()
    const parseResult = CreateVariationSchema.safeParse(body)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }
    const validated = parseResult.data

    if (validated.variationType === 'colour' && validated.price <= 0) {
      return apiError('Colour price must be greater than zero', 400)
    }

    // Validate style reference for colours
    if (validated.variationType === 'colour' && validated.styleId) {
      const parentStyle = await drizzleDb.query.productVariations.findFirst({
        where: and(
          eq(productVariations.id, validated.styleId),
          eq(productVariations.productId, id),
          eq(productVariations.variationType, 'styling'),
          isNull(productVariations.deletedAt)
        ),
      })
      if (!parentStyle) {
        return apiError(
          'Parent style not found or does not belong to this product',
          404
        )
      }
    }

    const activeCount = await drizzleDb.query.productVariations.findMany({
      where: and(
        eq(productVariations.productId, id),
        isNull(productVariations.deletedAt)
      ),
      columns: { id: true },
    })
    if (activeCount.length >= MAX_VARIATIONS_PER_PRODUCT) {
      return apiError('Maximum of 25 variations per product reached', 400)
    }

    const existingByName = await drizzleDb.query.productVariations.findFirst({
      where: and(
        eq(productVariations.productId, id),
        eq(productVariations.name, validated.name)
      ),
    })
    if (existingByName) {
      if (existingByName.deletedAt) {
        return apiError(
          'A variation with this name was previously archived. Please use a different name.',
          409
        )
      }
      return apiError(
        'A variation with this name already exists for this product',
        409
      )
    }

    const [variation] = await drizzleDb
      .insert(productVariations)
      .values({
        productId: id,
        styleId: validated.styleId ?? null,
        name: validated.name,
        designName: validated.designName,
        variationType: validated.variationType,
        price: validated.price,
        stock: validated.stock,
        image: validated.image ?? null,
        images: validated.images ?? [],
      })
      .returning()

    revalidateTag('products', {})
    await invalidateProductCaches(id)

    return apiSuccess(
      {
        variation: {
          ...variation,
          styleId: variation.styleId ?? null,
          image: variation.image ?? null,
          images: variation.images ?? [],
          deletedAt: null,
          createdAt: variation.createdAt.toISOString(),
          updatedAt: variation.updatedAt.toISOString(),
        },
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
