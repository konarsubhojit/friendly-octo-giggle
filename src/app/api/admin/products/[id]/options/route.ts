import { NextRequest } from 'next/server'
import { primaryDrizzleDb, drizzleDb } from '@/lib/db'
import { products, productOptions, productOptionValues } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
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

export const dynamic = 'force-dynamic'

const MAX_OPTIONS_PER_PRODUCT = 5

const CreateOptionWithValuesSchema = z.object({
  name: z
    .string()
    .min(1, 'Option name is required')
    .max(100, 'Option name must be under 100 characters'),
  sortOrder: z.number().int().nonnegative().default(0),
  values: z
    .array(
      z.object({
        value: z
          .string()
          .min(1, 'Value is required')
          .max(100, 'Value must be under 100 characters'),
        sortOrder: z.number().int().nonnegative().default(0),
      })
    )
    .min(1, 'At least one value is required')
    .max(50, 'Maximum 50 values per option'),
})

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
    const product = await drizzleDb.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
      columns: { id: true },
    })
    if (!product) {
      return apiError('Product not found', 404)
    }

    const options = await drizzleDb.query.productOptions.findMany({
      where: eq(productOptions.productId, id),
      orderBy: (o, { asc }) => [asc(o.sortOrder)],
      with: {
        values: {
          orderBy: (v, { asc }) => [asc(v.sortOrder)],
        },
      },
    })

    const serialized = options.map((opt) => ({
      id: opt.id,
      productId: opt.productId,
      name: opt.name,
      sortOrder: opt.sortOrder,
      createdAt: opt.createdAt.toISOString(),
      values: opt.values.map((val) => ({
        id: val.id,
        optionId: val.optionId,
        value: val.value,
        sortOrder: val.sortOrder,
        createdAt: val.createdAt.toISOString(),
      })),
    }))

    return apiSuccess({ options: serialized })
  } catch (error) {
    return handleApiError(error)
  }
}

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
    const product = await drizzleDb.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
      columns: { id: true },
    })
    if (!product) {
      return apiError('Product not found', 404)
    }

    const body = await request.json()
    const parseResult = CreateOptionWithValuesSchema.safeParse(body)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }

    const { name, sortOrder, values } = parseResult.data

    const existingOptions = await drizzleDb.query.productOptions.findMany({
      where: eq(productOptions.productId, id),
      columns: { id: true },
    })
    if (existingOptions.length >= MAX_OPTIONS_PER_PRODUCT) {
      return apiError(
        `Maximum of ${MAX_OPTIONS_PER_PRODUCT} options per product reached`,
        400
      )
    }

    const option = await primaryDrizzleDb.transaction(async (tx) => {
      const [newOption] = await tx
        .insert(productOptions)
        .values({ productId: id, name, sortOrder })
        .returning()

      if (values.length > 0) {
        await tx.insert(productOptionValues).values(
          values.map((v, idx) => ({
            optionId: newOption.id,
            value: v.value,
            sortOrder: v.sortOrder ?? idx,
          }))
        )
      }

      return tx.query.productOptions.findFirst({
        where: eq(productOptions.id, newOption.id),
        with: {
          values: {
            orderBy: (v, { asc }) => [asc(v.sortOrder)],
          },
        },
      })
    })

    if (!option) {
      return apiError('Failed to create option', 500)
    }

    revalidateTag('products', {})
    await invalidateProductCaches(id)

    const serialized = {
      id: option.id,
      productId: option.productId,
      name: option.name,
      sortOrder: option.sortOrder,
      createdAt: option.createdAt.toISOString(),
      values: option.values.map((val) => ({
        id: val.id,
        optionId: val.optionId,
        value: val.value,
        sortOrder: val.sortOrder,
        createdAt: val.createdAt.toISOString(),
      })),
    }

    return apiSuccess({ option: serialized }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
