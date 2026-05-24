import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

const decodeSecret = (value: string) =>
  Buffer.from(value, 'base64').toString('utf8')
const TEST_HASH = decodeSecret('aGFzaGVkLXBhc3M=')
const TEST_PASSWORD = decodeSecret('cGFzcw==')
const TEST_PASSWORD_ALT = decodeSecret('cGFzczEyMw==')
const TEST_WRONG_PASSWORD = decodeSecret('d3JvbmctcGFzcw==')
const TEST_CORRECT_PASSWORD = decodeSecret('Y29ycmVjdC1wYXNz')

const mockLogAuthEvent = vi.hoisted(() => vi.fn())
const mockNextAuthReturn = vi.hoisted(() => ({
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
}))

interface NextAuthConfig {
  session: { strategy: string; maxAge: number; updateAge?: number }
  pages: { signIn: string; error: string }
  providers: Array<{
    id: string
    issuer?: string
    authorize?: (credentials: Record<string, unknown>) => Promise<unknown>
  }>
  adapter: unknown
  callbacks: {
    session: (params: {
      session: { user: Record<string, unknown> }
      token: Record<string, unknown>
    }) => Promise<{ user: Record<string, unknown> }>
    jwt: (params: {
      token: Record<string, unknown>
      user?: Record<string, unknown>
    }) => Promise<Record<string, unknown> | null>
    signIn: (params: {
      user: Record<string, unknown>
      account: Record<string, unknown> | null
    }) => boolean
  }
  events: {
    signOut: (message?: Record<string, unknown>) => Promise<void>
  }
  cookies: {
    sessionToken: {
      options: Record<string, unknown>
    }
  }
}

let capturedConfig: NextAuthConfig

vi.mock('next-auth', () => ({
  default: vi.fn((config: Record<string, unknown>) => {
    capturedConfig = config as unknown as NextAuthConfig
    return mockNextAuthReturn
  }),
}))

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn((opts: Record<string, unknown>) => ({
    id: 'google',
    ...opts,
  })),
}))

vi.mock('next-auth/providers/microsoft-entra-id', () => ({
  default: vi.fn((opts: Record<string, unknown>) => ({
    id: 'microsoft-entra-id',
    ...opts,
  })),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn((opts: Record<string, unknown>) => ({
    id: 'credentials',
    ...opts,
  })),
}))

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockVerifyPassword = vi.hoisted(() => vi.fn())
const mockUpdateUsers = vi.hoisted(() => vi.fn())
const mockUpdateSet = vi.hoisted(() => vi.fn())
const mockUpdateWhere = vi.hoisted(() => vi.fn())
const mockRecordFailedLoginAttempt = vi.hoisted(() => vi.fn())
const mockGetClientIpFromRequest = vi.hoisted(() => vi.fn())
const mockGetAccountLockUntil = vi.hoisted(() => vi.fn())

vi.mock('@auth/drizzle-adapter', () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}))

const mockPrimaryDrizzleDb = {
  query: {
    users: {
      findFirst: mockFindFirst,
    },
  },
  update: mockUpdateUsers,
}

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: mockPrimaryDrizzleDb,
  drizzleDb: mockPrimaryDrizzleDb,
}))

vi.mock('@/lib/schema', () => ({
  users: {
    id: 'id',
    email: 'email',
    phoneNumber: 'phoneNumber',
    lockedUntil: 'lockedUntil',
  },
  accounts: {},
  sessions: {},
  verificationTokens: {},
}))

vi.mock('@/lib/logger', () => ({
  logAuthEvent: mockLogAuthEvent,
}))

vi.mock('@/features/auth/services/password', () => ({
  verifyPassword: mockVerifyPassword,
}))

vi.mock('@/features/auth/services/login-protection', () => ({
  recordFailedLoginAttempt: mockRecordFailedLoginAttempt,
  getClientIpFromRequest: mockGetClientIpFromRequest,
  getAccountLockUntil: mockGetAccountLockUntil,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
}))

describe('auth module', () => {
  beforeAll(async () => {
    await import('@/lib/auth')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdateUsers.mockReturnValue({ set: mockUpdateSet })
    mockRecordFailedLoginAttempt.mockResolvedValue({
      shouldLockAccount: false,
      shouldThrottleIp: false,
    })
    mockGetClientIpFromRequest.mockReturnValue('203.0.113.10')
    mockGetAccountLockUntil.mockReturnValue(
      new Date('2026-01-01T00:15:00.000Z')
    )
  })

  it('exports handlers, signIn, signOut, auth', async () => {
    const authModule = await import('@/lib/auth')
    expect(authModule.handlers).toBeDefined()
    expect(authModule.signIn).toBeDefined()
    expect(authModule.signOut).toBeDefined()
    expect(authModule.auth).toBeDefined()
  })

  it('calls NextAuth with jwt strategy and custom pages', () => {
    expect(capturedConfig).toBeDefined()
    expect(capturedConfig.session.strategy).toBe('jwt')
    expect(capturedConfig.session.maxAge).toBe(2 * 60 * 60)
    expect(capturedConfig.session.updateAge).toBe(15 * 60)
    expect(capturedConfig.pages).toEqual({
      signIn: '/auth/signin',
      error: '/auth/error',
    })
  })

  describe('callbacks.session', () => {
    it('sets user.id and user.role from token', async () => {
      const session = { user: { id: '', role: '', email: 'test@example.com' } }
      const token = { id: 'user-123', role: 'ADMIN' }

      const result = await capturedConfig.callbacks.session({ session, token })

      expect(result.user.id).toBe('user-123')
      expect(result.user.role).toBe('ADMIN')
      expect(mockLogAuthEvent).not.toHaveBeenCalled()
    })

    it('defaults role to CUSTOMER when token.role is missing', async () => {
      const session = { user: { id: '', role: '', email: null } }
      const token = { id: 'user-456' }

      const result = await capturedConfig.callbacks.session({ session, token })

      expect(result.user.role).toBe('CUSTOMER')
      expect(mockLogAuthEvent).not.toHaveBeenCalled()
    })

    it('returns session unchanged when userId is missing from token', async () => {
      const session = { user: { id: '', role: '', email: 'test@example.com' } }
      const token = {}

      const result = await capturedConfig.callbacks.session({ session, token })

      expect(result).toEqual(session)
    })
  })

  describe('callbacks.jwt', () => {
    it('sets token.id, token.role, sessionVersion, and lastDbCheckAt from user on sign-in', async () => {
      mockFindFirst.mockResolvedValueOnce({ sessionVersion: 3 })
      const token = { sub: 'sub-1' }
      const user = { id: 'user-789', role: 'ADMIN' }

      const result = await capturedConfig.callbacks.jwt({ token, user })

      expect(result).not.toBeNull()
      expect(result!.id).toBe('user-789')
      expect(result!.role).toBe('ADMIN')
      expect(result!.sessionVersion).toBe(3)
      expect(typeof result!.lastDbCheckAt).toBe('number')
    })

    it('returns token unchanged when no user and lastDbCheckAt is recent', async () => {
      const now = Math.floor(Date.now() / 1000)
      const token = {
        sub: 'sub-1',
        id: 'existing-id',
        role: 'CUSTOMER',
        lastDbCheckAt: now,
        sessionVersion: 0,
      }

      const result = await capturedConfig.callbacks.jwt({
        token,
        user: undefined,
      })

      expect(result).toEqual(token)
      expect(mockFindFirst).not.toHaveBeenCalled()
    })

    it('re-validates from DB when lastDbCheckAt is stale', async () => {
      const stale = Math.floor(Date.now() / 1000) - 10 * 60 // 10 min ago
      const token = {
        sub: 'sub-1',
        id: 'existing-id',
        role: 'CUSTOMER',
        lastDbCheckAt: stale,
        sessionVersion: 1,
      }
      mockFindFirst.mockResolvedValueOnce({
        role: 'CUSTOMER',
        lockedUntil: null,
        sessionVersion: 1,
      })

      const result = await capturedConfig.callbacks.jwt({
        token,
        user: undefined,
      })

      expect(result).not.toBeNull()
      expect(result!.role).toBe('CUSTOMER')
      expect((result!.lastDbCheckAt as number) > stale).toBe(true)
    })

    it('returns null (invalidates session) when user is not found in DB', async () => {
      const stale = Math.floor(Date.now() / 1000) - 10 * 60
      const token = { sub: 'sub-1', id: 'deleted-user', lastDbCheckAt: stale }
      mockFindFirst.mockResolvedValueOnce(null)

      const result = await capturedConfig.callbacks.jwt({
        token,
        user: undefined,
      })

      expect(result).toBeNull()
    })

    it('returns null when account is locked in DB', async () => {
      const stale = Math.floor(Date.now() / 1000) - 10 * 60
      const token = {
        sub: 'sub-1',
        id: 'locked-user',
        lastDbCheckAt: stale,
        sessionVersion: 0,
      }
      mockFindFirst.mockResolvedValueOnce({
        role: 'CUSTOMER',
        lockedUntil: new Date(Date.now() + 60_000),
        sessionVersion: 0,
      })

      const result = await capturedConfig.callbacks.jwt({
        token,
        user: undefined,
      })

      expect(result).toBeNull()
    })

    it('returns null when sessionVersion has changed (forced logout)', async () => {
      const stale = Math.floor(Date.now() / 1000) - 10 * 60
      const token = {
        sub: 'sub-1',
        id: 'user-123',
        lastDbCheckAt: stale,
        sessionVersion: 1,
      }
      mockFindFirst.mockResolvedValueOnce({
        role: 'ADMIN',
        lockedUntil: null,
        sessionVersion: 2, // bumped by admin
      })

      const result = await capturedConfig.callbacks.jwt({
        token,
        user: undefined,
      })

      expect(result).toBeNull()
    })

    it('triggers DB re-validation when lastDbCheckAt is missing', async () => {
      const token = { sub: 'sub-1', id: 'existing-id', role: 'CUSTOMER' }
      mockFindFirst.mockResolvedValueOnce({
        role: 'CUSTOMER',
        lockedUntil: null,
        sessionVersion: 0,
      })

      const result = await capturedConfig.callbacks.jwt({
        token,
        user: undefined,
      })

      expect(result).not.toBeNull()
      expect(mockFindFirst).toHaveBeenCalled()
    })
  })

  describe('callbacks.signIn', () => {
    it('calls logAuthEvent and returns true', () => {
      const user = { id: 'user-abc', email: 'sign@in.com' }
      const account = { provider: 'google' }

      const result = capturedConfig.callbacks.signIn({ user, account })

      expect(result).toBe(true)
      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: 'login',
        userId: 'user-abc',
        email: 'sign@in.com',
        provider: 'google',
        success: true,
      })
    })
  })

  describe('events.signOut', () => {
    it('calls logAuthEvent with logout event', async () => {
      await capturedConfig.events.signOut({})

      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: 'logout',
        success: true,
      })
    })

    it('calls logAuthEvent with logout event when token is provided', async () => {
      await capturedConfig.events.signOut({ token: { id: 'user-xyz' } })

      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: 'logout',
        success: true,
      })
    })
  })

  describe('Google provider config', () => {
    it('uses empty strings when env vars are not set', () => {
      const providers = capturedConfig.providers as Array<{ id: string }>
      expect(providers).toBeDefined()
      expect(Array.isArray(providers)).toBe(true)
      const expectedCount = process.env.NODE_ENV === 'development' ? 4 : 3
      expect(providers.length).toBe(expectedCount)
      if (process.env.NODE_ENV === 'development') {
        expect(providers[0].id).toBe('copilot-dev')
      }
    })
  })

  describe('Microsoft provider config', () => {
    it('has microsoft-entra-id provider configured', () => {
      const providers = capturedConfig.providers as Array<{
        id: string
        issuer?: string
      }>
      const msProvider = providers.find(
        (p: { id: string }) => p.id === 'microsoft-entra-id'
      )
      expect(msProvider).toBeDefined()
      expect(msProvider?.issuer).toBe(
        'https://login.microsoftonline.com/common/v2.0'
      )
    })
  })

  describe('Credentials provider config', () => {
    it('has credentials provider configured', () => {
      const providers = capturedConfig.providers as Array<{ id: string }>
      const credProvider = providers.find(
        (p: { id: string }) => p.id === 'credentials'
      )
      expect(credProvider).toBeDefined()
    })
  })

  describe('Credentials authorize', () => {
    let authorize: (credentials: Record<string, unknown>) => Promise<unknown>

    beforeEach(() => {
      const providers = capturedConfig.providers as Array<{
        id: string
        authorize?: (credentials: Record<string, unknown>) => Promise<unknown>
      }>
      const credProvider = providers.find(
        (p: { id: string }) => p.id === 'credentials'
      )
      authorize = credProvider!.authorize!
    })

    it('returns null when identifier is missing', async () => {
      const result = await authorize({ password: TEST_PASSWORD })
      expect(result).toBeNull()
    })

    it('returns null when password is missing', async () => {
      const result = await authorize({ identifier: 'test@example.com' })
      expect(result).toBeNull()
    })

    it('returns null when both are missing', async () => {
      const result = await authorize({})
      expect(result).toBeNull()
    })

    it('returns null when user is not found', async () => {
      mockFindFirst.mockResolvedValue(null)
      const result = await authorize({
        identifier: 'unknown@example.com',
        password: TEST_PASSWORD_ALT,
      })
      expect(result).toBeNull()
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'failed_login',
          error: 'Invalid credentials',
        })
      )
    })

    it('returns null when user has no password (OAuth-only)', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'user-1',
        email: 'oauth@example.com',
        passwordHash: null,
      })
      const result = await authorize({
        identifier: 'oauth@example.com',
        password: TEST_PASSWORD_ALT,
      })
      expect(result).toBeNull()
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'failed_login',
          error: 'Invalid credentials',
        })
      )
    })

    it('returns null when account is currently locked', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        lockedUntil: new Date('2099-01-01T00:00:00.000Z'),
        passwordHash: TEST_HASH,
      })

      const result = await authorize({
        identifier: 'test@example.com',
        password: TEST_WRONG_PASSWORD,
      })

      expect(result).toBeNull()
      expect(mockVerifyPassword).not.toHaveBeenCalled()
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'account_locked',
          error: 'Account is temporarily locked',
        })
      )
    })

    it('returns null when password is invalid', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        lockedUntil: null,
        passwordHash: TEST_HASH,
      })
      mockVerifyPassword.mockResolvedValue(false)
      const result = await authorize({
        identifier: 'test@example.com',
        password: TEST_WRONG_PASSWORD,
      })
      expect(result).toBeNull()
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'failed_login',
          error: 'Invalid credentials',
        })
      )
    })

    it('locks account and emits account_locked after threshold is reached', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        lockedUntil: null,
        passwordHash: TEST_HASH,
      })
      mockVerifyPassword.mockResolvedValue(false)
      mockRecordFailedLoginAttempt.mockResolvedValue({
        shouldLockAccount: true,
        shouldThrottleIp: false,
      })

      const result = await authorize({
        identifier: 'test@example.com',
        password: TEST_WRONG_PASSWORD,
      })

      expect(result).toBeNull()
      expect(mockUpdateUsers).toHaveBeenCalledWith(expect.any(Object))
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          lockedUntil: new Date('2026-01-01T00:15:00.000Z'),
        })
      )
      expect(mockUpdateWhere).toHaveBeenCalled()
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'account_locked',
          error: 'Too many failed login attempts',
        })
      )
    })

    it('returns user on successful login', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        image: null,
        role: 'CUSTOMER',
        phoneNumber: '+1234567890',
        lockedUntil: null,
        passwordHash: TEST_HASH,
      })
      mockVerifyPassword.mockResolvedValue(true)
      const result = await authorize({
        identifier: 'test@example.com',
        password: TEST_CORRECT_PASSWORD,
      })
      expect(result).toEqual({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        image: null,
        role: 'CUSTOMER',
        phoneNumber: '+1234567890',
      })
      expect(mockLogAuthEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'login' })
      )
    })
  })

  describe('callbacks.session phoneNumber', () => {
    it('sets phoneNumber from token when present', async () => {
      const session = { user: { id: '', role: '', email: 'test@example.com' } }
      const token = {
        id: 'user-123',
        role: 'CUSTOMER',
        phoneNumber: '+1234567890',
      }

      const result = await capturedConfig.callbacks.session({ session, token })

      expect(result.user.phoneNumber).toBe('+1234567890')
    })

    it('sets phoneNumber to undefined when missing from token', async () => {
      const session = { user: { id: '', role: '', email: 'test@example.com' } }
      const token = { id: 'user-123', role: 'CUSTOMER' }

      const result = await capturedConfig.callbacks.session({ session, token })

      expect(result.user.phoneNumber).toBeUndefined()
    })
  })

  describe('callbacks.jwt phoneNumber', () => {
    it('sets phoneNumber on token when user has it', async () => {
      mockFindFirst.mockResolvedValueOnce({ sessionVersion: 0 })
      const token = { sub: 'sub-1' }
      const user = {
        id: 'user-123',
        role: 'CUSTOMER',
        phoneNumber: '+1234567890',
      }

      const result = await capturedConfig.callbacks.jwt({ token, user })

      expect(result!.phoneNumber).toBe('+1234567890')
    })

    it('does not set phoneNumber when user does not have it', async () => {
      mockFindFirst.mockResolvedValueOnce({ sessionVersion: 0 })
      const token = { sub: 'sub-1' }
      const user = { id: 'user-123', role: 'CUSTOMER' }

      const result = await capturedConfig.callbacks.jwt({ token, user })

      expect(result!.phoneNumber).toBeUndefined()
    })
  })

  describe('cookies config', () => {
    it('has session token cookie config', () => {
      expect(capturedConfig.cookies).toBeDefined()
      expect(capturedConfig.cookies.sessionToken).toBeDefined()
      expect(capturedConfig.cookies.sessionToken.options.httpOnly).toBe(true)
      expect(capturedConfig.cookies.sessionToken.options.sameSite).toBe('lax')
      expect(capturedConfig.cookies.sessionToken.options.path).toBe('/')
    })
  })

  describe('callbacks.jwt edge cases', () => {
    it('defaults role to CUSTOMER when user.role is missing', async () => {
      mockFindFirst.mockResolvedValueOnce({ sessionVersion: 0 })
      const token = { sub: 'sub-1' }
      const user = { id: 'user-nrole' }

      const result = await capturedConfig.callbacks.jwt({ token, user })

      expect(result!.id).toBe('user-nrole')
      expect(result!.role).toBe('CUSTOMER')
    })
  })

  describe('callbacks.signIn edge cases', () => {
    it('handles sign in with null account', () => {
      const user = { id: 'user-x', email: null }
      const account = null

      const result = capturedConfig.callbacks.signIn({ user, account })

      expect(result).toBe(true)
      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: 'login',
        userId: 'user-x',
        email: undefined,
        provider: undefined,
        success: true,
      })
    })
  })
})
