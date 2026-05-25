import { createHmac, timingSafeEqual } from 'node:crypto'

export const CART_SESSION_COOKIE_NAME = 'cart_session'
const CART_SESSION_COOKIE_VERSION = 'v1'

const getCartSessionSecret = (): string => {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required to sign cart_session cookies')
  }
  return secret
}

const createCartSessionSignature = (sessionId: string): string =>
  createHmac('sha256', getCartSessionSecret())
    .update(`${CART_SESSION_COOKIE_VERSION}.${sessionId}`)
    .digest('base64url')

export const createGuestCartSessionId = (): string =>
  `guest_${Date.now()}_${crypto.randomUUID()}`

export const signCartSessionCookieValue = (sessionId: string): string => {
  const signature = createCartSessionSignature(sessionId)
  return `${CART_SESSION_COOKIE_VERSION}.${sessionId}.${signature}`
}

export const verifyCartSessionCookieValue = (
  cookieValue: string | undefined
): string | undefined => {
  if (!cookieValue) return undefined

  const [version, sessionId, signature, ...rest] = cookieValue.split('.')
  if (
    rest.length > 0 ||
    version !== CART_SESSION_COOKIE_VERSION ||
    !sessionId ||
    !signature
  ) {
    return undefined
  }

  const expectedSignature = createCartSessionSignature(sessionId)
  const providedSignature = Buffer.from(signature)
  const expectedSignatureBuffer = Buffer.from(expectedSignature)

  if (providedSignature.length !== expectedSignatureBuffer.length) {
    return undefined
  }

  return timingSafeEqual(providedSignature, expectedSignatureBuffer)
    ? sessionId
    : undefined
}
