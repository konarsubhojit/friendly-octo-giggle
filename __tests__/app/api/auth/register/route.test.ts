import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const decodeSecret = (value: string) =>
  Buffer.from(value, 'base64').toString('utf8')
const STRONG_PASSWORD = decodeSecret('U3Ryb25nUGFzczEh')
const WEAK_PASSWORD = decodeSecret('d2Vhaw==')
const MISMATCH_PASSWORD = decodeSecret('ZGlmZmVyZW50')

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockInsertReturning = vi.hoisted(() => vi.fn())
const mockInsertValues = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockInsertReturning }))
)
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockInsertValues })))
const mockHashPassword = vi.hoisted(() => vi.fn())
const mockSavePasswordToHistory = vi.hoisted(() => vi.fn())
const mockLogAuthEvent = vi.hoisted(() => vi.fn())
const mockLogError = vi.hoisted(() => vi.fn())
const mockDeleteWhere = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() =>
  vi.fn(() => ({ where: mockDeleteWhere.mockResolvedValue(undefined) }))
)
const mockPublishJSON = vi.hoisted(() => vi.fn())
const mockGenerateEmailVerificationToken = vi.hoisted(() => vi.fn())
const mockCreateEmailVerificationIdentifier = vi.hoisted(() => vi.fn())

const mockPrimaryDrizzleDb = {
  query: {
    users: {
      findFirst: mockFindFirst,
    },
  },
  delete: mockDelete,
  insert: mockInsert,
}

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: mockPrimaryDrizzleDb,
  drizzleDb: mockPrimaryDrizzleDb,
}))

vi.mock('@/lib/schema', () => ({
  users: {
    email: 'email',
    phoneNumber: 'phoneNumber',
    id: 'id',
  },
  verificationTokens: {
    identifier: 'identifier',
    token: 'token',
    expires: 'expires',
  },
}))

vi.mock('@/features/auth/services/password', () => ({
  hashPassword: mockHashPassword,
  savePasswordToHistory: mockSavePasswordToHistory,
}))

vi.mock('@/lib/logger', () => ({
  logAuthEvent: mockLogAuthEvent,
  logError: mockLogError,
}))

vi.mock('@/lib/qstash', () => ({
  getQStashClient: () => ({
    publishJSON: mockPublishJSON,
  }),
}))

vi.mock('@/features/auth/services/email-verification', () => ({
  createEmailVerificationIdentifier: mockCreateEmailVerificationIdentifier,
  generateEmailVerificationToken: mockGenerateEmailVerificationToken,
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
}))

describe('POST /api/auth/register', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockCreateEmailVerificationIdentifier.mockReturnValue(
      'email-verify:new-user-id'
    )
    mockGenerateEmailVerificationToken.mockReturnValue({
      plainToken: 'verify-plain-token',
      tokenHash: 'verify-token-hash',
      expiresAt: new Date('2026-01-01T00:30:00.000Z'),
    })
    mockDeleteWhere.mockResolvedValue(undefined)
    mockPublishJSON.mockResolvedValue(undefined)
    const mod = await import('@/app/api/auth/register/route')
    POST = mod.POST
  })

  it('returns 201 on successful registration', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockHashPassword.mockResolvedValue('hashed-pw')
    mockInsertReturning.mockResolvedValue([{ id: 'new-user-id' }])
    mockSavePasswordToHistory.mockResolvedValue(undefined)

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.userId).toBe('new-user-id')
    expect(mockDeleteWhere).toHaveBeenCalledOnce()
    expect(mockInsertValues).toHaveBeenNthCalledWith(2, {
      identifier: 'email-verify:new-user-id',
      token: 'verify-token-hash',
      expires: new Date('2026-01-01T00:30:00.000Z'),
    })
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:3000/api/services/email-verification-email',
        body: expect.objectContaining({
          type: 'auth.email_verification_requested',
        }),
      })
    )
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'register', success: true })
    )
  })

  it('returns 409 when email already exists', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'existing-id',
      email: 'test@example.com',
    })

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.success).toBe(false)
    expect(data.error).toContain('email')
  })

  it('returns 400 on validation errors', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: '',
        email: 'invalid',
        password: WEAK_PASSWORD,
        confirmPassword: MISMATCH_PASSWORD,
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
  })
})
