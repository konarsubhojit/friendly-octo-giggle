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
const mockParseEmailVerificationIdentifier = vi.hoisted(() => vi.fn())
const mockHashEmailVerificationToken = vi.hoisted(() => vi.fn())

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
    emailVerified: 'emailVerified',
    updatedAt: 'updatedAt',
  },
  verificationTokens: {
    identifier: 'identifier',
    token: 'token',
    expires: 'expires',
  },
}))

vi.mock('@/features/auth/services/email-verification', () => ({
  parseEmailVerificationIdentifier: mockParseEmailVerificationIdentifier,
  hashEmailVerificationToken: mockHashEmailVerificationToken,
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  gt: vi.fn((...args: unknown[]) => ({ op: 'gt', args })),
}))

describe('POST /api/auth/verify-email', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockParseEmailVerificationIdentifier.mockReturnValue('user-1')
    mockHashEmailVerificationToken.mockReturnValue('hashed-token')
    mockFindFirst.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'existing-password-hash',
      emailVerified: null,
    })
    mockDeleteReturning.mockResolvedValue([{ token: 'hashed-token' }])

    const mod = await import('@/app/api/auth/verify-email/route')
    POST = mod.POST
  })

  it('returns 400 on validation failure', async () => {
    const req = new NextRequest('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed identifier', async () => {
    mockParseEmailVerificationIdentifier.mockReturnValue(null)
    const req = new NextRequest('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'invalid',
        token: 'plain-token',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when token cannot be consumed', async () => {
    mockDeleteReturning.mockResolvedValue([])
    const req = new NextRequest('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'email-verify:user-1',
        token: 'plain-token',
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid or expired')
  })

  it('marks email verified when token is valid', async () => {
    const req = new NextRequest('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'email-verify:user-1',
        token: 'plain-token',
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerified: expect.any(Date),
      })
    )
  })
})
