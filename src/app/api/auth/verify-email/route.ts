import { NextRequest } from 'next/server'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { primaryDrizzleDb } from '@/lib/db'
import { users, verificationTokens } from '@/lib/schema'
import {
  hashEmailVerificationToken,
  parseEmailVerificationIdentifier,
} from '@/features/auth/services/email-verification'
import { logAuthEvent } from '@/lib/logger'

const verifyEmailSchema = z.object({
  identifier: z.string().min(1, 'identifier is required'),
  token: z.string().min(1, 'token is required'),
})

const INVALID_TOKEN_ERROR = 'Invalid or expired verification token'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parseResult = verifyEmailSchema.safeParse(body)
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

    const { identifier, token } = parseResult.data
    const userId = parseEmailVerificationIdentifier(identifier)
    if (!userId) {
      return apiError(INVALID_TOKEN_ERROR, 400)
    }

    const user = await primaryDrizzleDb.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, emailVerified: true, passwordHash: true },
    })

    if (!user?.passwordHash) {
      logAuthEvent({
        event: 'failed_login',
        userId: user?.id,
        success: false,
        error: 'Invalid verification target',
      })
      return apiError(INVALID_TOKEN_ERROR, 400)
    }

    const hashedToken = hashEmailVerificationToken(token)
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

    if (!user.emailVerified) {
      await primaryDrizzleDb
        .update(users)
        .set({ emailVerified: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id))
    }

    return apiSuccess({ message: 'Email verified successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}
