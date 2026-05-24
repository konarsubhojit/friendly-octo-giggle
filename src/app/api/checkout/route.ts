import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import {
  enqueueCheckoutForUser,
  isCheckoutRequestError,
} from '@/features/cart/services/checkout-service'
import { withLogging } from '@/lib/api-middleware'
import { apiError, isJsonBodyParseError, parseJsonBody } from '@/lib/api-utils'
import { logBusinessEvent, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
// Route-level validation intentionally stays loose because checkout-service
// injects authenticated user defaults and performs strict SubmitCheckoutSchema
// validation before enqueueing.
const CheckoutRequestBodySchema = z.record(z.string(), z.unknown())

const handlePost = async (request: NextRequest) => {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      logBusinessEvent({
        event: 'checkout_request_failed',
        details: { reason: 'not_authenticated' },
        success: false,
      })
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to place orders.' },
        { status: 401 }
      )
    }

    const body = await parseJsonBody(request, CheckoutRequestBodySchema)
    const result = await enqueueCheckoutForUser({
      body,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    })

    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (isJsonBodyParseError(error)) {
      return apiError(error.message, error.status, error.details)
    }

    if (isCheckoutRequestError(error)) {
      return apiError(error.message, error.status)
    }

    logError({
      error,
      context: 'checkout_request_creation',
      additionalInfo: {
        path: request.nextUrl.pathname,
      },
    })
    return NextResponse.json(
      { error: 'Failed to create checkout request' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(handlePost)
