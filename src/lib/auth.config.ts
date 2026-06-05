import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id'

/**
 * Edge-safe NextAuth configuration.
 *
 * This file MUST NOT import anything that depends on Node-only APIs
 * (database driver, `pino` logger, `prom-client` metrics, `bcryptjs`, etc.)
 * because it is consumed by `proxy.ts`, which runs in the Next.js edge
 * runtime. The full Node-side configuration (Drizzle adapter, Credentials
 * provider with DB lookup, JWT DB re-validation callback, and auth-event
 * logging) is composed on top of this object in `./auth.ts`.
 *
 * See the NextAuth v5 split-config pattern:
 * https://authjs.dev/guides/edge-compatibility
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
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
    // Edge-safe: reads only fields already present on the JWT, never touches
    // the database. The Node-side `jwt` callback (in ./auth.ts) is what
    // populates these fields and re-validates them against the DB.
    async session({ session, token }) {
      const userId = token.id as string | undefined
      if (!session.user || !userId) {
        return session
      }
      session.user.id = userId
      session.user.role = (token.role as 'ADMIN' | 'CUSTOMER') || 'CUSTOMER'
      session.user.phoneNumber =
        (token.phoneNumber as string | null | undefined) || undefined
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 2 * 60 * 60, // 2 hours
    updateAge: 15 * 60, // Roll the cookie every 15 minutes of activity
  },
} satisfies NextAuthConfig
