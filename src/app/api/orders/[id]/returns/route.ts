import { NextRequest } from 'next/server'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { auth } from '@/lib/auth'
import { getFeatureFlags } from '@/lib/edge-config'
import {
  invalidateUserOrderCaches,
  invalidateAdminOrderCaches,
} from '@/lib/cache'
import { CreateReturnRequestSchema } from '@/features/orders/validations'
import {
  ReturnRequestError,
  createReturnRequest,
  getReturnEligibility,
} from '@/features/orders/services/return-service'

/** These responses are user-specific and must never be shared. */
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

/**
 * What this customer may return from this order.
 *
 * Ownership is enforced inside the service, which reports somebody else's
 * order as 404 rather than 403 so the endpoint cannot confirm that an
 * identifier exists.
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
    const [eligibility, flags] = await Promise.all([
      getReturnEligibility(id, session.user.id),
      getFeatureFlags(),
    ])

    // The order detail page is a Client Component, so it cannot read Edge
    // Config itself — it is server-only and async. Returning the flag here
    // keeps the connection string out of the client bundle while still
    // letting the page decide whether to offer the Instagram video channel.
    return apiSuccess(
      {
        ...eligibility,
        instagramVideoEnabled: flags.returnVideoViaInstagram,
      },
      200,
      PRIVATE_HEADERS
    )
  } catch (error) {
    if (error instanceof ReturnRequestError) {
      return apiError(error.message, error.status)
    }
    return handleApiError(error)
  }
}

/** Submit a damaged-item return claim. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params
    const parsed = await parseJsonBody(request, CreateReturnRequestSchema)

    const created = await createReturnRequest(id, session.user.id, parsed)

    // The claim changes what the customer sees on the order and adds work to
    // the admin queue, so both cache families are invalidated.
    await Promise.all([
      invalidateUserOrderCaches(session.user.id),
      invalidateAdminOrderCaches(id, session.user.id),
    ])

    return apiSuccess(created, 201, PRIVATE_HEADERS)
  } catch (error) {
    if (error instanceof ReturnRequestError) {
      // `code` lets the client render the precise reason rather than a
      // generic failure.
      return apiError(error.message, error.status, { code: error.code })
    }
    return handleApiError(error)
  }
}
