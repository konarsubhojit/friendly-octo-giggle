import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { cacheProductById } from '@/lib/cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await cacheProductById(id, () => db.products.findById(id))

    if (!product) {
      return apiError('Product not found', 404)
    }

    return apiSuccess({ product }, 200, {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
