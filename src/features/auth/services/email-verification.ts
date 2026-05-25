import { createHash, randomBytes } from 'node:crypto'

const EMAIL_VERIFICATION_TOKEN_BYTES = 32
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 30 * 60 * 1000
const EMAIL_VERIFICATION_IDENTIFIER_PREFIX = 'email-verify:'

export const createEmailVerificationIdentifier = (userId: string): string =>
  `${EMAIL_VERIFICATION_IDENTIFIER_PREFIX}${userId}`

export const parseEmailVerificationIdentifier = (
  identifier: string
): string | null =>
  identifier.startsWith(EMAIL_VERIFICATION_IDENTIFIER_PREFIX)
    ? identifier.slice(EMAIL_VERIFICATION_IDENTIFIER_PREFIX.length)
    : null

export const hashEmailVerificationToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

export const generateEmailVerificationToken = (): {
  plainToken: string
  tokenHash: string
  expiresAt: Date
} => {
  const plainToken = randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString('hex')
  return {
    plainToken,
    tokenHash: hashEmailVerificationToken(plainToken),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
  }
}
