import { NextRequest } from 'next/server'
import { registerSchema } from '@/features/auth/validations'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import {
  hashPassword,
  savePasswordToHistory,
} from '@/features/auth/services/password'
import { primaryDrizzleDb } from '@/lib/db'
import { users, verificationTokens } from '@/lib/schema'
import { eq, or } from 'drizzle-orm'
import { logAuthEvent, logError } from '@/lib/logger'
import {
  createEmailVerificationIdentifier,
  generateEmailVerificationToken,
} from '@/features/auth/services/email-verification'
import { getQStashClient } from '@/lib/qstash'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parseResult = registerSchema.safeParse(body)

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

    const { name, email, phoneNumber, password } = parseResult.data

    const conditions = [eq(users.email, email)]
    if (phoneNumber) {
      conditions.push(eq(users.phoneNumber, phoneNumber))
    }

    const existingUser = await primaryDrizzleDb.query.users.findFirst({
      where: or(...conditions),
    })

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'phone number'
      return apiError(`A user with this ${field} already exists`, 409)
    }

    const passwordHash = await hashPassword(password)

    const [newUser] = await primaryDrizzleDb
      .insert(users)
      .values({
        name,
        email,
        phoneNumber: phoneNumber || null,
        passwordHash,
      })
      .returning({ id: users.id })

    await savePasswordToHistory(newUser.id, passwordHash)

    const identifier = createEmailVerificationIdentifier(newUser.id)
    const { plainToken, tokenHash, expiresAt } = generateEmailVerificationToken()

    await primaryDrizzleDb
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier))

    await primaryDrizzleDb.insert(verificationTokens).values({
      identifier,
      token: tokenHash,
      expires: expiresAt,
    })

    const appBaseUrl = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const verifyUrl = `${appBaseUrl}/auth/verify-email?token=${encodeURIComponent(plainToken)}&identifier=${encodeURIComponent(identifier)}`
    try {
      await getQStashClient().publishJSON({
        url: `${appBaseUrl}/api/services/email-verification-email`,
        body: {
          type: 'auth.email_verification_requested',
          data: {
            to: email,
            customerName: name,
            verifyUrl,
          },
        },
      })
    } catch (publishError) {
      logError({
        error: publishError,
        context: 'email_verification_qstash_publish_failed',
        additionalInfo: { email, userId: newUser.id },
      })
    }

    logAuthEvent({
      event: 'register',
      userId: newUser.id,
      email,
      success: true,
    })

    return apiSuccess({ userId: newUser.id }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
