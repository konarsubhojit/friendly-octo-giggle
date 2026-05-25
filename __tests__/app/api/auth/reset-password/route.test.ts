import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockDeleteReturning = vi.hoisted(() => vi.fn())
const mockDeleteWhere = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockDeleteReturning }))
)
const mockDelete = vi.hoisted(() => vi.fn(() => ({ where: mockDeleteWhere })))
const mockUpdateWhere = vi.hoisted(() => vi.fn())
const mockUpdateSet = vi.hoisted(() =>
  vi.fn(() => ({ where: mockUpdateWhere.mockResolvedValue(undefined) }))
)
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })))
const mockConsumeResetPasswordRateLimits = vi.hoisted(() => vi.fn())
const mockParsePasswordResetIdentifier = vi.hoisted(() => vi.fn())
const mockHashPasswordResetToken = vi.hoisted(() => vi.fn())
const mockCheckPasswordHistory = vi.hoisted(() => vi.fn())
const mockHashPassword = vi.hoisted(() => vi.fn())
const mockSavePasswordToHistory = vi.hoisted(() => vi.fn())
const mockGetClientIpFromRequest = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    query: {
      users: {
        findFirst: mockFindFirst,
      },
    },
    delete: mockDelete,
    update: mockUpdate,
  },
}))

vi.mock('@/lib/schema', () => ({
  users: {
    id: 'id',
    passwordHash: 'passwordHash',
    updatedAt: 'updatedAt',
  },
  verificationTokens: {
    identifier: 'identifier',
    token: 'token',
    expires: 'expires',
  },
}))

vi.mock('@/features/auth/services/login-protection', () => ({
  getClientIpFromRequest: mockGetClientIpFromRequest,
}))

vi.mock('@/features/auth/services/password-reset', () => ({
  consumeResetPasswordRateLimits: mockConsumeResetPasswordRateLimits,
  hashPasswordResetToken: mockHashPasswordResetToken,
  parsePasswordResetIdentifier: mockParsePasswordResetIdentifier,
}))

vi.mock('@/features/auth/services/password', () => ({
  checkPasswordHistory: mockCheckPasswordHistory,
  hashPassword: mockHashPassword,
  savePasswordToHistory: mockSavePasswordToHistory,
}))

vi.mock('@/lib/logger', () => ({
  logAuthEvent: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  gt: vi.fn((...args: unknown[]) => ({ op: 'gt', args })),
}))

describe('POST /api/auth/reset-password', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetClientIpFromRequest.mockReturnValue('203.0.113.10')
    mockConsumeResetPasswordRateLimits.mockResolvedValue({
      identifierLimited: false,
      ipLimited: false,
    })
    mockParsePasswordResetIdentifier.mockReturnValue('user-1')
    mockHashPasswordResetToken.mockReturnValue('hashed-token')
    mockFindFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'old-hash',
    })
    mockCheckPasswordHistory.mockResolvedValue(false)
    mockDeleteReturning.mockResolvedValue([{ token: 'hashed-token' }])
    mockHashPassword.mockResolvedValue('new-hash')
    mockSavePasswordToHistory.mockResolvedValue(undefined)

    const mod = await import('@/app/api/auth/reset-password/route')
    POST = mod.POST
  })

  it('returns 400 when validation fails', async () => {
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier: '',
        token: '',
        newPassword: 'weak',
        confirmNewPassword: 'different',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 429 when reset rate limit is exceeded', async () => {
    mockConsumeResetPasswordRateLimits.mockResolvedValue({
      identifierLimited: true,
      ipLimited: false,
    })

    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'password-reset:user-1',
        token: 'plain',
        newPassword: 'NewStrong1!',
        confirmNewPassword: 'NewStrong1!',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 when password was recently used', async () => {
    mockCheckPasswordHistory.mockResolvedValue(true)

    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'password-reset:user-1',
        token: 'plain',
        newPassword: 'NewStrong1!',
        confirmNewPassword: 'NewStrong1!',
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('last 2 passwords')
  })

  it('updates password and saves history for a valid reset token', async () => {
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'password-reset:user-1',
        token: 'plain',
        newPassword: 'NewStrong1!',
        confirmNewPassword: 'NewStrong1!',
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockDeleteWhere).toHaveBeenCalledOnce()
    expect(mockHashPassword).toHaveBeenCalledWith('NewStrong1!')
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: 'new-hash',
      })
    )
    expect(mockSavePasswordToHistory).toHaveBeenCalledWith('user-1', 'new-hash')
  })
})

