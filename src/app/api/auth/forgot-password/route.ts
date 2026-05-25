import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { forgotPasswordSchema } from '@/features/auth/validations'
import { getClientIpFromRequest } from '@/features/auth/services/login-protection'
import {
  consumeForgotPasswordRateLimits,
  createPasswordResetIdentifier,
  generatePasswordResetToken,
  normalizeEmailForLookup,
} from '@/features/auth/services/password-reset'
import { apiSuccess } from '@/lib/api-utils'
import { primaryDrizzleDb } from '@/lib/db'
import { users, verificationTokens } from '@/lib/schema'
import { getQStashClient } from '@/lib/qstash'
import { logError } from '@/lib/logger'
import { env } from '@/lib/env'

const SUCCESS_MESSAGE =
  'If an account exists for that email, you will receive a password reset link shortly.'

export async function POST(request: NextRequest) {
  let normalizedEmail = ''

  try {
    const body = await request.json()
    const parseResult = forgotPasswordSchema.safeParse(body)
    if (!parseResult.success) {
      return apiSuccess({ message: SUCCESS_MESSAGE })
    }

    normalizedEmail = normalizeEmailForLookup(parseResult.data.email)
    const ipAddress = getClientIpFromRequest(request)

    const rateLimitResult = await consumeForgotPasswordRateLimits({
      email: normalizedEmail,
      ipAddress,
    })
    if (rateLimitResult.emailLimited || rateLimitResult.ipLimited) {
      return apiSuccess({ message: SUCCESS_MESSAGE })
    }

    const user = await primaryDrizzleDb.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
      columns: { id: true, email: true, name: true, passwordHash: true },
    })

    if (!user?.passwordHash) {
      return apiSuccess({ message: SUCCESS_MESSAGE })
    }

    const identifier = createPasswordResetIdentifier(user.id)
    const { plainToken, tokenHash, expiresAt } = generatePasswordResetToken()

    await primaryDrizzleDb
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier))

    await primaryDrizzleDb.insert(verificationTokens).values({
      identifier,
      token: tokenHash,
      expires: expiresAt,
    })

    const resetUrl = `${env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/reset-password?token=${encodeURIComponent(plainToken)}&identifier=${encodeURIComponent(identifier)}`

    try {
      await getQStashClient().publishJSON({
        url: `${env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/services/password-reset-email`,
        body: {
          type: 'password.reset_requested',
          data: {
            to: user.email,
            customerName: user.name ?? 'there',
            resetUrl,
          },
        },
      })
    } catch (publishError) {
      logError({
        error: publishError,
        context: 'password_reset_qstash_publish_failed',
        additionalInfo: { email: user.email, userId: user.id },
      })
    }
    return apiSuccess({ message: SUCCESS_MESSAGE })
  } catch (error) {
    logError({
      error,
      context: 'forgot_password_failed',
      additionalInfo: normalizedEmail ? { email: normalizedEmail } : undefined,
    })
    return apiSuccess({ message: SUCCESS_MESSAGE })
  }
}
