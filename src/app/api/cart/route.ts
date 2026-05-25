import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AddToCartSchema } from '@/features/cart/validations'
import { apiError, isJsonBodyParseError, parseJsonBody } from '@/lib/api-utils'
import { logError } from '@/lib/logger'
import {
  addItemToCart,
  buildGuestSessionCookieOptions,
  clearCart,
  getCart,
  getCartIdentity,
  isCartRequestError,
  mergeGuestCartIntoUserCart,
} from '@/features/cart/services/cart-service'
import {
  CART_SESSION_COOKIE_NAME,
  signCartSessionCookieValue,
  verifyCartSessionCookieValue,
} from '@/features/cart/services/cart-session'

export const dynamic = 'force-dynamic'

const getGuestCartSessionCookie = (request: NextRequest) => {
  const cookieValue = request.cookies.get(CART_SESSION_COOKIE_NAME)?.value
  return {
    cookieValue,
    sessionId: verifyCartSessionCookieValue(cookieValue),
  }
}

const deleteInvalidGuestCartSessionCookie = (
  response: NextResponse,
  cookieValue: string | undefined,
  sessionId: string | undefined
) => {
  if (cookieValue && !sessionId) {
    response.cookies.delete(CART_SESSION_COOKIE_NAME)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { cookieValue, sessionId } = getGuestCartSessionCookie(request)
    const rotatedSessionId =
      session?.user?.id && sessionId
        ? await mergeGuestCartIntoUserCart(session.user.id, sessionId)
        : undefined
    const identity = getCartIdentity(
      session,
      session?.user?.id ? undefined : sessionId
    )
    const result = await getCart(identity)
    const response = NextResponse.json(result)

    deleteInvalidGuestCartSessionCookie(response, cookieValue, sessionId)

    if (rotatedSessionId) {
      response.cookies.set(
        CART_SESSION_COOKIE_NAME,
        signCartSessionCookieValue(rotatedSessionId),
        buildGuestSessionCookieOptions()
      )
    }

    return response
  } catch (error) {
    logError({ error, context: 'cart_fetch' })
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { cookieValue, sessionId } = getGuestCartSessionCookie(request)
    const [session, body] = await Promise.all([
      auth(),
      parseJsonBody(request, AddToCartSchema),
    ])
    const rotatedSessionId =
      session?.user?.id && sessionId
        ? await mergeGuestCartIntoUserCart(session.user.id, sessionId)
        : undefined
    const result = await addItemToCart(
      session,
      body,
      session?.user?.id ? undefined : sessionId
    )

    const responseBody = {
      cart: result.cart,
      ...(result.warning
        ? {
            warning: result.warning,
            adjustedQuantity: result.adjustedQuantity,
          }
        : {}),
    }
    const response = NextResponse.json(responseBody, { status: 201 })
    const nextGuestSessionId = result.sessionId ?? rotatedSessionId

    if (nextGuestSessionId) {
      response.cookies.set(
        CART_SESSION_COOKIE_NAME,
        signCartSessionCookieValue(nextGuestSessionId),
        buildGuestSessionCookieOptions()
      )
    } else {
      deleteInvalidGuestCartSessionCookie(response, cookieValue, sessionId)
    }

    return response
  } catch (error) {
    if (isJsonBodyParseError(error)) {
      return apiError(error.message, error.status, error.details)
    }

    if (isCartRequestError(error)) {
      return apiError(error.message, error.status)
    }

    logError({ error, context: 'cart_add' })
    return NextResponse.json(
      { error: 'Failed to add to cart' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    const { cookieValue, sessionId } = getGuestCartSessionCookie(request)
    const identity = getCartIdentity(session, sessionId)
    await clearCart(identity)

    const response = NextResponse.json({ success: true })

    if (!identity.userId && identity.sessionId) {
      response.cookies.delete(CART_SESSION_COOKIE_NAME)
    } else {
      deleteInvalidGuestCartSessionCookie(response, cookieValue, sessionId)
    }

    return response
  } catch (error) {
    logError({ error, context: 'cart_clear' })
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 })
  }
}
