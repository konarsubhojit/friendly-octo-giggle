import { randomBytes, createHash } from 'node:crypto'
import {
  createRateLimiter,
  type RateLimiter,
} from '@/lib/rate-limiter'

const PASSWORD_RESET_TOKEN_BYTES = 32 // NOSONAR S2068: byte length constant, not a credential
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000
const PASSWORD_RESET_IDENTIFIER_PREFIX = 'password-reset:' // NOSONAR S2068: namespace prefix for Redis keys, not a credential

const FORGOT_LIMIT_WINDOW_S = 15 * 60
const RESET_LIMIT_WINDOW_S = 15 * 60
const FORGOT_LIMIT_PER_EMAIL = 3
const FORGOT_LIMIT_PER_IP = 10
const RESET_LIMIT_PER_IDENTIFIER = 10
const RESET_LIMIT_PER_IP = 20

let forgotByEmailLimiter: RateLimiter | null = null
let forgotByIpLimiter: RateLimiter | null = null
let resetByIdentifierLimiter: RateLimiter | null = null
let resetByIpLimiter: RateLimiter | null = null

const getForgotByEmailLimiter = (): RateLimiter | null => {
  forgotByEmailLimiter ??= createRateLimiter({
    maxRequests: FORGOT_LIMIT_PER_EMAIL,
    windowSeconds: FORGOT_LIMIT_WINDOW_S,
    prefix: 'rl:auth:forgot:email',
  })
  return forgotByEmailLimiter
}

const getForgotByIpLimiter = (): RateLimiter | null => {
  forgotByIpLimiter ??= createRateLimiter({
    maxRequests: FORGOT_LIMIT_PER_IP,
    windowSeconds: FORGOT_LIMIT_WINDOW_S,
    prefix: 'rl:auth:forgot:ip',
  })
  return forgotByIpLimiter
}

const getResetByIdentifierLimiter = (): RateLimiter | null => {
  resetByIdentifierLimiter ??= createRateLimiter({
    maxRequests: RESET_LIMIT_PER_IDENTIFIER,
    windowSeconds: RESET_LIMIT_WINDOW_S,
    prefix: 'rl:auth:reset:identifier',
  })
  return resetByIdentifierLimiter
}

const getResetByIpLimiter = (): RateLimiter | null => {
  resetByIpLimiter ??= createRateLimiter({
    maxRequests: RESET_LIMIT_PER_IP,
    windowSeconds: RESET_LIMIT_WINDOW_S,
    prefix: 'rl:auth:reset:ip',
  })
  return resetByIpLimiter
}

const normalizeRateLimitResult = (
  result: { success: boolean } | null
): boolean => Boolean(result && !result.success)

export const normalizeEmailForLookup = (email: string): string =>
  email.trim().toLowerCase()

export const createPasswordResetIdentifier = (userId: string): string =>
  `${PASSWORD_RESET_IDENTIFIER_PREFIX}${userId}`

export const parsePasswordResetIdentifier = (
  identifier: string
): string | null =>
  identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)
    ? identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length)
    : null

export const hashPasswordResetToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

export const generatePasswordResetToken = (): {
  plainToken: string
  tokenHash: string
  expiresAt: Date
} => {
  const plainToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex')
  return {
    plainToken,
    tokenHash: hashPasswordResetToken(plainToken),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  }
}

export const consumeForgotPasswordRateLimits = async ({
  email,
  ipAddress,
}: {
  email: string
  ipAddress: string
}): Promise<{ emailLimited: boolean; ipLimited: boolean }> => {
  const emailLimiter = getForgotByEmailLimiter()
  const ipLimiter = getForgotByIpLimiter()

  const [emailResult, ipResult] = await Promise.all([
    emailLimiter ? emailLimiter.limit(email) : Promise.resolve(null),
    ipLimiter ? ipLimiter.limit(ipAddress) : Promise.resolve(null),
  ])

  return {
    emailLimited: normalizeRateLimitResult(emailResult),
    ipLimited: normalizeRateLimitResult(ipResult),
  }
}

export const consumeResetPasswordRateLimits = async ({
  identifier,
  ipAddress,
}: {
  identifier: string
  ipAddress: string
}): Promise<{ identifierLimited: boolean; ipLimited: boolean }> => {
  const identifierLimiter = getResetByIdentifierLimiter()
  const ipLimiter = getResetByIpLimiter()

  const [identifierResult, ipResult] = await Promise.all([
    identifierLimiter
      ? identifierLimiter.limit(identifier)
      : Promise.resolve(null),
    ipLimiter ? ipLimiter.limit(ipAddress) : Promise.resolve(null),
  ])

  return {
    identifierLimited: normalizeRateLimitResult(identifierResult),
    ipLimited: normalizeRateLimitResult(ipResult),
  }
}
