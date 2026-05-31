import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { primaryDrizzleDb } from '@/lib/db'
import { users, accounts, sessions, verificationTokens } from '@/lib/schema'
import type { Adapter } from 'next-auth/adapters'
import { logAuthEvent } from './logger'
import { verifyPassword } from '@/features/auth/services/password'
import { eq, or } from 'drizzle-orm'
import {
  getAccountLockUntil,
  getClientIpFromRequest,
  recordFailedLoginAttempt,
} from '@/features/auth/services/login-protection'
import { authConfig } from './auth.config'

const INVALID_CREDENTIALS_ERROR = 'Invalid credentials'

/** How often (in seconds) to re-validate a token against the DB. */
const JWT_DB_CHECK_INTERVAL = 5 * 60

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(primaryDrizzleDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  providers: [
    // OAuth providers come from the edge-safe config; Credentials is added
    // here because its `authorize` callback performs a DB lookup and cannot
    // run in the edge runtime.
    ...authConfig.providers,
    Credentials({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const identifier = credentials?.identifier as string | undefined
        const password = credentials?.password as string | undefined
        const ipAddress = getClientIpFromRequest(request)

        if (!identifier || !password) return null

        // Look up user by email first, then by phoneNumber
        const user = await primaryDrizzleDb.query.users.findFirst({
          where: or(
            eq(users.email, identifier),
            eq(users.phoneNumber, identifier)
          ),
        })

        if (!user) {
          await recordFailedLoginAttempt({ ipAddress })
          logAuthEvent({
            event: 'failed_login',
            email: identifier,
            success: false,
            error: INVALID_CREDENTIALS_ERROR,
          })
          return null
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          logAuthEvent({
            event: 'account_locked',
            userId: user.id,
            email: user.email,
            success: false,
            error: 'Account is temporarily locked',
          })
          return null
        }

        // OAuth-only users don't have a password hash
        if (!user.passwordHash) {
          const failedAttempt = await recordFailedLoginAttempt({
            userId: user.id,
            ipAddress,
          })

          if (failedAttempt.shouldLockAccount) {
            const lockedUntil = getAccountLockUntil()
            await primaryDrizzleDb
              .update(users)
              .set({ lockedUntil, updatedAt: new Date() })
              .where(eq(users.id, user.id))
            logAuthEvent({
              event: 'account_locked',
              userId: user.id,
              email: user.email,
              success: false,
              error: 'Too many failed login attempts',
            })
          }

          logAuthEvent({
            event: 'failed_login',
            userId: user.id,
            email: user.email,
            success: false,
            error: INVALID_CREDENTIALS_ERROR,
          })
          return null
        }

        // Credentials users must verify email before sign in.
        if (!user.emailVerified) {
          logAuthEvent({
            event: 'failed_login',
            userId: user.id,
            email: user.email,
            success: false,
            error: 'Email not verified',
          })
          return null
        }

        const isValid = await verifyPassword(password, user.passwordHash)
        if (!isValid) {
          const failedAttempt = await recordFailedLoginAttempt({
            userId: user.id,
            ipAddress,
          })

          if (failedAttempt.shouldLockAccount) {
            const lockedUntil = getAccountLockUntil()
            await primaryDrizzleDb
              .update(users)
              .set({ lockedUntil, updatedAt: new Date() })
              .where(eq(users.id, user.id))
            logAuthEvent({
              event: 'account_locked',
              userId: user.id,
              email: user.email,
              success: false,
              error: 'Too many failed login attempts',
            })
          }

          logAuthEvent({
            event: 'failed_login',
            userId: user.id,
            email: user.email,
            success: false,
            error: INVALID_CREDENTIALS_ERROR,
          })
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          phoneNumber: user.phoneNumber,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        // Sign-in: populate token from user object
        token.id = user.id ?? ''
        token.role = user.role || 'CUSTOMER'
        if ('phoneNumber' in user && user.phoneNumber) {
          token.phoneNumber = user.phoneNumber
        }

        // Fetch sessionVersion from DB so forced-logout can be detected later
        if (user.id) {
          const dbUser = await primaryDrizzleDb.query.users.findFirst({
            where: eq(users.id, user.id),
            columns: { sessionVersion: true },
          })
          token.sessionVersion = dbUser?.sessionVersion ?? 0
        }

        token.lastDbCheckAt = Math.floor(Date.now() / 1000)
        return token
      }

      // Subsequent requests: periodically re-validate role & lock status from DB
      const userId = token.id as string | undefined
      if (!userId) return token

      const lastCheck = token.lastDbCheckAt as number | undefined
      const now = Math.floor(Date.now() / 1000)

      if (lastCheck === undefined || now - lastCheck >= JWT_DB_CHECK_INTERVAL) {
        const dbUser = await primaryDrizzleDb.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { role: true, lockedUntil: true, sessionVersion: true },
        })

        // User deleted → invalidate
        if (!dbUser) return null

        // Account locked → invalidate
        if (dbUser.lockedUntil && dbUser.lockedUntil > new Date()) {
          return null
        }

        // Session version bumped (admin forced logout-all) → invalidate
        const storedVersion = token.sessionVersion as number | undefined
        if (
          storedVersion !== undefined &&
          dbUser.sessionVersion !== storedVersion
        ) {
          return null
        }

        // Refresh token with latest DB state
        token.role = dbUser.role
        token.sessionVersion = dbUser.sessionVersion
        token.lastDbCheckAt = now
      }

      return token
    },
    signIn({ user, account }) {
      // Log successful sign-in
      logAuthEvent({
        event: 'login',
        userId: user.id,
        email: user.email || undefined,
        provider: account?.provider,
        success: true,
      })
      return true
    },
  },
  events: {
    async signOut() {
      logAuthEvent({
        event: 'logout',
        success: true,
      })
    },
  },
})
