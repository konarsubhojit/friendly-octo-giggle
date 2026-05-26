import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'ADMIN' | 'CUSTOMER'
      phoneNumber?: string | null
    } & DefaultSession['user']
  }

  interface User {
    role: 'ADMIN' | 'CUSTOMER'
    phoneNumber?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'CUSTOMER'
    phoneNumber?: string | null
    /** Server-side monotonic counter; bump to force logout-all for a user. */
    sessionVersion?: number
    /** Unix epoch seconds when the DB was last consulted for this token. */
    lastDbCheckAt?: number
  }
}
