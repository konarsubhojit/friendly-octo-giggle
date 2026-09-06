import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { auth } from '@/lib/auth'
import { primaryDrizzleDb } from '@/lib/db'
import { returnRequests } from '@/lib/schema'
import { serializeCustomerReturn } from '@/lib/serializers'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

/**
 * One return, as its owner may see it.
 *
 * A return belonging to another customer returns **404, not 403**: 403 would
 * confirm that the identifier exists, which turns this endpoint into an oracle
 * for enumerating return ids.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params

    const found = await primaryDrizzleDb.query.returnRequests.findFirst({
      where: eq(returnRequests.id, id),
      with: {
        items: true,
        evidence: true,
        refund: true,
      },
    })

    if (found?.userId !== session.user.id) {
      return apiError('Return not found', 404)
    }

    return apiSuccess(serializeCustomerReturn(found), 200, PRIVATE_HEADERS)
  } catch (error) {
    return handleApiError(error)
  }
}
