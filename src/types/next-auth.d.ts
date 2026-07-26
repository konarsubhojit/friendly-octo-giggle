import { DefaultSession } from 'next-auth'
import type { UserRole } from '@/lib/constants/roles'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      phoneNumber?: string | null
    } & DefaultSession['user']
  }

  interface User {
    role: UserRole
    phoneNumber?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    phoneNumber?: string | null
    /** Server-side monotonic counter; bump to force logout-all for a user. */
    sessionVersion?: number
    /** Unix epoch seconds when the DB was last consulted for this token. */
    lastDbCheckAt?: number
  }
}
