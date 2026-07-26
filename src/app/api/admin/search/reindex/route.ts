import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { drizzleDb } from '@/lib/db'
import { products } from '@/lib/schema'
import { isNull } from 'drizzle-orm'
import {
  getIndexInfo,
  indexProducts,
  isSearchAvailable,
  resetIndex,
} from '@/lib/search'
import {
  areOrdersSearchControlsAvailable,
  createOrRefreshOrdersSearchIndex,
} from '@/features/orders/services/orders-search-index'
import { z } from 'zod'

const reindexRequestSchema = z
  .object({
    target: z.enum(['products', 'orders']).optional(),
  })
  .optional()

/**
 * POST /api/admin/search/reindex
 *
 * Rebuild search indexes for products or orders.
 */
export async function POST(request: Request) {
  const authCheck = await checkAdminAuth('system:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const body = await parseJsonBody(request, reindexRequestSchema, {
      allowEmpty: true,
    })
    const target = body?.target ?? 'products'

    if (target === 'orders') {
      if (!areOrdersSearchControlsAvailable()) {
        return apiError('Redis Search is not configured', 503)
      }

      const result = await createOrRefreshOrdersSearchIndex()

      return apiSuccess({
        reindexed: { orders: result.indexedOrders },
        details: { ordersIndexCreated: result.indexCreated },
      })
    }

    if (!isSearchAvailable()) {
      return apiError('Search is not configured', 503)
    }

    await resetIndex('products')

    const allProducts = await drizzleDb.query.products.findMany({
      where: isNull(products.deletedAt),
    })

    await indexProducts(
      allProducts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        image: p.image,
      })),
      { throwOnError: true }
    )

    if (allProducts.length > 0) {
      await getIndexInfo('products')
    }

    return apiSuccess({ reindexed: { products: allProducts.length } })
  } catch (error) {
    return handleApiError(error)
  }
}
