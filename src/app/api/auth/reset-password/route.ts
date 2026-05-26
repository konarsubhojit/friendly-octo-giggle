import { NextRequest } from 'next/server'
import { and, eq, gt } from 'drizzle-orm'
import { resetPasswordSchema } from '@/features/auth/validations'
import { getClientIpFromRequest } from '@/features/auth/services/login-protection'
import {
  consumeResetPasswordRateLimits,
  hashPasswordResetToken,
  parsePasswordResetIdentifier,
} from '@/features/auth/services/password-reset'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { primaryDrizzleDb } from '@/lib/db'
import { users, verificationTokens } from '@/lib/schema'
import {
  checkPasswordHistory,
  hashPassword,
  savePasswordToHistory,
} from '@/features/auth/services/password'
import { logAuthEvent } from '@/lib/logger'

const INVALID_TOKEN_ERROR = 'Invalid or expired reset token'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parseResult = resetPasswordSchema.safeParse(body)
    if (!parseResult.success) {
      const details = parseResult.error.issues.reduce(
        (acc, err) => {
          const path = err.path.join('.')
          acc[path] = err.message
          return acc
        },
        {} as Record<string, string>
      )
      return apiError('Validation failed', 400, details)
    }

    const { identifier, token, newPassword } = parseResult.data

    const ipAddress = getClientIpFromRequest(request)
    const rateLimitResult = await consumeResetPasswordRateLimits({
      identifier,
      ipAddress,
    })
    if (rateLimitResult.identifierLimited || rateLimitResult.ipLimited) {
      return apiError('Too many reset attempts. Please try again later.', 429)
    }

    const userId = parsePasswordResetIdentifier(identifier)
    if (!userId) {
      return apiError(INVALID_TOKEN_ERROR, 400)
    }

    const user = await primaryDrizzleDb.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, email: true, passwordHash: true },
    })
    if (!user?.passwordHash) {
      return apiError(INVALID_TOKEN_ERROR, 400)
    }

    const wasRecentlyUsed = await checkPasswordHistory(user.id, newPassword)
    if (wasRecentlyUsed) {
      return apiError(
        'New password must be different from your last 2 passwords',
        400
      )
    }

    const hashedToken = hashPasswordResetToken(token)
    const [consumedToken] = await primaryDrizzleDb
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, hashedToken),
          gt(verificationTokens.expires, new Date())
        )
      )
      .returning({ token: verificationTokens.token })

    if (!consumedToken) {
      return apiError(INVALID_TOKEN_ERROR, 400)
    }

    const newHash = await hashPassword(newPassword)
    await primaryDrizzleDb
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id))

    await savePasswordToHistory(user.id, newHash)

    logAuthEvent({
      event: 'password_change',
      userId: user.id,
      email: user.email,
      success: true,
    })

    return apiSuccess({ message: 'Password reset successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}
