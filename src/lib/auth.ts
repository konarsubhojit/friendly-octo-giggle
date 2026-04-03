import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { primaryDrizzleDb } from '@/lib/db'
import { users, accounts, sessions, verificationTokens } from '@/lib/schema'
import type { Adapter } from 'next-auth/adapters'
import { logAuthEvent } from './logger'
import { verifyPassword } from '@/features/auth/services/password'
import { eq, or } from 'drizzle-orm'
import { cacheUserSession, invalidateUserSessionCache } from '@/lib/cache'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(primaryDrizzleDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID
        ? process.env.GOOGLE_CLIENT_ID
        : '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
        ? process.env.GOOGLE_CLIENT_SECRET
        : '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    MicrosoftEntraId({
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      issuer: 'https://login.microsoftonline.com/common/v2.0',
      authorization: { params: { scope: 'openid profile email User.Read' } },
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier as string | undefined
        const password = credentials?.password as string | undefined

        if (!identifier || !password) return null

        // Look up user by email first, then by phoneNumber
        const user = await primaryDrizzleDb.query.users.findFirst({
          where: or(
            eq(users.email, identifier),
            eq(users.phoneNumber, identifier)
          ),
        })

        if (!user) {
          logAuthEvent({
            event: 'failed_login',
            email: identifier,
            success: false,
            error: 'User not found',
          })
          return null
        }

        // OAuth-only users don't have a password hash
        if (!user.passwordHash) {
          logAuthEvent({
            event: 'failed_login',
            userId: user.id,
            email: user.email,
            success: false,
            error: 'No password set (OAuth-only user)',
          })
          return null
        }

        const isValid = await verifyPassword(password, user.passwordHash)
        if (!isValid) {
          logAuthEvent({
            event: 'failed_login',
            userId: user.id,
            email: user.email,
            success: false,
            error: 'Invalid password',
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
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      const userId = token.id as string
      if (!session.user || !userId) {
        return session
      }

      const userData = await cacheUserSession(userId, () => ({
        id: userId,
        role: (token.role as 'ADMIN' | 'CUSTOMER') || 'CUSTOMER',
        phoneNumber:
          (token.phoneNumber as string | null | undefined) || undefined,
      }))

      session.user.id = userData.id
      session.user.role = userData.role
      session.user.phoneNumber = userData.phoneNumber

      return session
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? ''
        token.role = user.role || 'CUSTOMER'
        if ('phoneNumber' in user && user.phoneNumber) {
          token.phoneNumber = user.phoneNumber
        }
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
    async signOut(message) {
      if ('token' in message && message.token?.id) {
        await invalidateUserSessionCache(message.token.id as string)
      }
      // Log sign-out (user ID not available in signOut event)
      logAuthEvent({
        event: 'logout',
        success: true,
      })
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
})
