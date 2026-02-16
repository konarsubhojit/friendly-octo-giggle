import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { drizzleDb } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/schema';
import type { Adapter } from 'next-auth/adapters';
import { logAuthEvent } from './logger';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(drizzleDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as 'CUSTOMER' | 'ADMIN') || 'CUSTOMER';

        // Log session creation
        logAuthEvent({
          event: 'session_created',
          userId: token.id as string,
          email: session.user.email || undefined,
          success: true,
        });
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'CUSTOMER';
      }
      return token;
    },
    async signIn({ user, account }) {
      // Log successful sign-in
      logAuthEvent({
        event: 'login',
        userId: user.id,
        email: user.email || undefined,
        provider: account?.provider,
        success: true,
      });
      return true;
    },
  },
  events: {
    async signOut() {
      // Log sign-out (user ID not available in signOut event)
      logAuthEvent({
        event: 'logout',
        success: true,
      });
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
});
