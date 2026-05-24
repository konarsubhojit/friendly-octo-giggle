import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { CreateShareSchema } from '@/features/product/validations'
import { withLogging } from '@/lib/api-middleware'

export const dynamic = 'force-dynamic'

const handlePost = async (request: NextRequest) => {
  try {
    const { productId, variantId } = await parseJsonBody(
      request,
      CreateShareSchema
    )

    const key = await db.shares.create(productId, variantId ?? null)

    const origin = request.nextUrl.origin
    const shareUrl = `${origin}/s/${key}`

    return apiSuccess({ key, shareUrl }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

export const POST = withLogging(handlePost)
