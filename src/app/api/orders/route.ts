import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/api-middleware'
import { z } from 'zod'
import {
  enqueueCheckoutForUser,
  isCheckoutRequestError,
} from '@/features/cart/services/checkout-service'
import { logBusinessEvent, logError } from '@/lib/logger'
import { auth } from '@/lib/auth'
import { apiError, isJsonBodyParseError, parseJsonBody } from '@/lib/api-utils'
import {
  getUserOrders,
  isOrderRequestError,
} from '@/features/orders/services/order-service'

export const dynamic = 'force-dynamic'
const CheckoutRequestBodySchema = z
  .object({
    customerName: z.string().optional(),
    customerEmail: z.string().optional(),
    customerAddress: z.string().optional(),
    items: z.array(z.unknown()).optional(),
  })
  .passthrough()

const handleGet = async (request: NextRequest) => {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const result = await getUserOrders({
      requestUrl: request.url,
      userId: session.user.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    logError({
      error,
      context: 'fetch_user_orders',
    })
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

const handlePost = async (request: NextRequest) => {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      logBusinessEvent({
        event: 'order_create_failed',
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

    if (isOrderRequestError(error)) {
      return apiError(error.message, error.status)
    }

    logError({
      error,
      context: 'order_checkout_enqueue',
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

export const GET = withLogging(handleGet)
export const POST = withLogging(handlePost)
