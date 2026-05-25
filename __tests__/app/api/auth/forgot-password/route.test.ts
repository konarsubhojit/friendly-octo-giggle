import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockDeleteWhere = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() =>
  vi.fn(() => ({
    where: mockDeleteWhere.mockResolvedValue(undefined),
  }))
)
const mockInsertValues = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockInsertValues })))
const mockPublishJSON = vi.hoisted(() => vi.fn())
const mockConsumeForgotPasswordRateLimits = vi.hoisted(() => vi.fn())
const mockGeneratePasswordResetToken = vi.hoisted(() => vi.fn())
const mockCreatePasswordResetIdentifier = vi.hoisted(() => vi.fn())
const mockGetClientIpFromRequest = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    query: {
      users: {
        findFirst: mockFindFirst,
      },
    },
    delete: mockDelete,
    insert: mockInsert,
  },
}))

vi.mock('@/lib/schema', () => ({
  users: {
    email: 'email',
    id: 'id',
  },
  verificationTokens: {
    identifier: 'identifier',
  },
}))

vi.mock('@/lib/qstash', () => ({
  getQStashClient: () => ({
    publishJSON: mockPublishJSON,
  }),
}))

vi.mock('@/features/auth/services/login-protection', () => ({
  getClientIpFromRequest: mockGetClientIpFromRequest,
}))

vi.mock('@/features/auth/services/password-reset', () => ({
  consumeForgotPasswordRateLimits: mockConsumeForgotPasswordRateLimits,
  createPasswordResetIdentifier: mockCreatePasswordResetIdentifier,
  generatePasswordResetToken: mockGeneratePasswordResetToken,
  normalizeEmailForLookup: (email: string) => email.trim().toLowerCase(),
}))

vi.mock('@/lib/logger', () => ({
  logAuthEvent: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}))

describe('POST /api/auth/forgot-password', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetClientIpFromRequest.mockReturnValue('203.0.113.5')
    mockConsumeForgotPasswordRateLimits.mockResolvedValue({
      emailLimited: false,
      ipLimited: false,
    })
    mockGeneratePasswordResetToken.mockReturnValue({
      plainToken: 'plain-token',
      tokenHash: 'hashed-token',
      expiresAt: new Date('2026-01-01T00:30:00.000Z'),
    })
    mockCreatePasswordResetIdentifier.mockReturnValue('password-reset:user-1')
    mockInsertValues.mockResolvedValue(undefined)

    const mod = await import('@/app/api/auth/forgot-password/route')
    POST = mod.POST
  })

  it('returns 200 generic success for invalid input', async () => {
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns 200 generic success when rate limited', async () => {
    mockConsumeForgotPasswordRateLimits.mockResolvedValue({
      emailLimited: true,
      ipLimited: false,
    })
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('stores a hashed token and queues reset email for matching user', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Jane',
      passwordHash: 'existing-hash',
    })

    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockDeleteWhere).toHaveBeenCalledOnce()
    expect(mockInsertValues).toHaveBeenCalledWith({
      identifier: 'password-reset:user-1',
      token: 'hashed-token',
      expires: new Date('2026-01-01T00:30:00.000Z'),
    })
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:3000/api/services/password-reset-email',
        body: expect.objectContaining({
          type: 'password.reset_requested',
          data: expect.objectContaining({
            to: 'user@example.com',
          }),
        }),
      })
    )
    expect(mockPublishJSON.mock.calls[0]?.[0]?.body?.data?.resetUrl).toContain(
      'token=plain-token'
    )
  })
})
