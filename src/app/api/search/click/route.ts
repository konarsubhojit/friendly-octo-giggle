import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiSuccess, handleApiError, parseJsonBody } from '@/lib/api-utils'
import { logBusinessEvent } from '@/lib/logger'

const SearchClickSchema = z.object({
  productId: z.string().min(1),
  query: z.string().trim().max(200).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { productId, query } = await parseJsonBody(request, SearchClickSchema)

    logBusinessEvent({
      event: 'search_result_click',
      details: {
        productId,
        query: query ?? null,
      },
      success: true,
    })

    return apiSuccess({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
