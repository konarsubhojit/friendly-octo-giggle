import { NextRequest } from 'next/server'
import { primaryDrizzleDb, drizzleDb } from '@/lib/db'
import {
  products,
  productOptions,
  productOptionValues,
  productVariants,
  productVariantOptionValues,
} from '@/lib/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
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

const GenerateOptionsSchema = z.object({
  optionNames: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Option name is required')
        .max(100, 'Option name must be under 100 characters')
    )
    .min(1, 'At least one option name is required')
    .max(5, 'Maximum 5 option names')
    .refine(
      (names) => {
        const normalized = names.map((n) => n.toLowerCase())
        return new Set(normalized).size === normalized.length
      },
      { message: 'Option names must be unique' }
    ),
  delimiter: z
    .string()
    .trim()
    .min(1, 'Delimiter is required')
    .max(5, 'Delimiter must be 5 characters or fewer')
    .default('-'),
})

/**
 * POST /api/admin/products/[id]/options/generate
 *
 * Accepts option dimension names (e.g. ["Color", "Size"]) and a delimiter.
 * Splits each variant's SKU by the delimiter, extracts unique values per
 * dimension, creates ProductOption + ProductOptionValue rows, and links
 * each variant to its matching option values via ProductVariantOptionValue.
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
    const product = await drizzleDb.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
      columns: { id: true },
    })
    if (!product) {
      return apiError('Product not found', 404)
    }

    const body = await request.json()
    const parseResult = GenerateOptionsSchema.safeParse(body)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }

    const { optionNames, delimiter } = parseResult.data

    // Fetch active variants with their SKUs
    const variants = await drizzleDb.query.productVariants.findMany({
      where: and(
        eq(productVariants.productId, id),
        isNull(productVariants.deletedAt)
      ),
    })

    if (variants.length === 0) {
      return apiError('No variants found for this product', 400)
    }

    // Validate that all variants have SKUs that split into the right number of segments
    const skuSegments: { variantId: string; segments: string[] }[] = []
    for (const variant of variants) {
      if (!variant.sku) {
        return apiError(
          `Variant ${variant.id} has no SKU. All variants must have SKUs to generate options.`,
          400
        )
      }
      const segments = variant.sku.split(delimiter).map((s) => s.trim())
      if (segments.length !== optionNames.length) {
        return apiError(
          `SKU "${variant.sku}" splits into ${segments.length} segments but ${optionNames.length} option names were provided. ` +
            `Expected format: ${optionNames.join(delimiter)}`,
          400
        )
      }
      skuSegments.push({ variantId: variant.id, segments })
    }

    // Collect unique values per option dimension (sorted for deterministic order)
    const uniqueValuesPerOption: Set<string>[] = Array.from(
      { length: optionNames.length },
      () => new Set<string>()
    )
    for (const { segments } of skuSegments) {
      for (let i = 0; i < segments.length; i++) {
        uniqueValuesPerOption[i].add(segments[i])
      }
    }

    // Run everything in a transaction with product row lock
    const result = await primaryDrizzleDb.transaction(async (tx) => {
      // Lock the product row to prevent concurrent generate requests
      await tx.execute(sql`SELECT id FROM products WHERE id = ${id} FOR UPDATE`)

      // Delete existing options for this product.
      // Cascade: productOptions → productOptionValues → productVariantOptionValues
      await tx.delete(productOptions).where(eq(productOptions.productId, id))

      // Create options and their values
      const optionValueIdMap: Map<string, string> = new Map() // "optionIndex:value" → valueId

      for (let i = 0; i < optionNames.length; i++) {
        const [newOption] = await tx
          .insert(productOptions)
          .values({
            productId: id,
            name: optionNames[i],
            sortOrder: i,
          })
          .returning()

        const values = [...uniqueValuesPerOption[i]].sort()
        if (values.length > 0) {
          const insertedValues = await tx
            .insert(productOptionValues)
            .values(
              values.map((value, idx) => ({
                optionId: newOption.id,
                value,
                sortOrder: idx,
              }))
            )
            .returning()

          for (const iv of insertedValues) {
            optionValueIdMap.set(`${i}:${iv.value}`, iv.id)
          }
        }
      }

      // Batch-insert all variant-option-value links at once
      const allLinks: { variantId: string; optionValueId: string }[] = []
      for (const { variantId, segments } of skuSegments) {
        for (let i = 0; i < segments.length; i++) {
          const optionValueId = optionValueIdMap.get(`${i}:${segments[i]}`)
          if (optionValueId) {
            allLinks.push({ variantId, optionValueId })
          }
        }
      }
      if (allLinks.length > 0) {
        await tx.insert(productVariantOptionValues).values(allLinks)
      }

      // Fetch and return the created options with values
      return tx.query.productOptions.findMany({
        where: eq(productOptions.productId, id),
        orderBy: (o, { asc }) => [asc(o.sortOrder)],
        with: {
          values: {
            orderBy: (v, { asc }) => [asc(v.sortOrder)],
          },
        },
      })
    })

    revalidateTag('products')
    await invalidateProductCaches(id)

    const serialized = result.map((opt) => ({
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

    return apiSuccess(
      {
        options: serialized,
        variantsLinked: skuSegments.length,
      },
      201
    )
  } catch (error: unknown) {
    if (error instanceof Error) {
      return handleApiError(error)
    }
    return apiError('Failed to generate options', 500)
  }
}
