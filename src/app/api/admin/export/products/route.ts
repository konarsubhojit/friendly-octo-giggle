import { asc, isNull } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { products } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { streamCsvResponse } from '@/features/admin/services/admin-csv'
import { apiError, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const rows = await drizzleDb.query.products.findMany({
      where: isNull(products.deletedAt),
      orderBy: [asc(products.createdAt)],
      with: { variants: true },
    })

    const csvRows = rows.map((product) => {
      const minPrice = product.variants.length
        ? Math.min(...product.variants.map((variant) => variant.price))
        : 0
      const totalStock = product.variants.reduce(
        (sum, variant) => sum + variant.stock,
        0
      )

      return [
        product.id,
        product.name,
        product.description,
        product.category,
        product.image,
        JSON.stringify(product.images),
        minPrice,
        totalStock,
        product.createdAt.toISOString(),
      ]
    })

    return streamCsvResponse(
      'products.csv',
      [
        'id',
        'name',
        'description',
        'category',
        'image',
        'images',
        'minPrice',
        'stock',
        'createdAt',
      ],
      csvRows
    )
  } catch (error) {
    return handleApiError(error)
  }
}
