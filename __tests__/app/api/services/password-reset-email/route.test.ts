import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerify = vi.hoisted(() => vi.fn())
const mockSendEmail = vi.hoisted(() => vi.fn())
const mockGetQStashReceiver = vi.hoisted(() => vi.fn())

const mockEnv = {
  QSTASH_CURRENT_SIGNING_KEY: undefined as string | undefined,
  QSTASH_NEXT_SIGNING_KEY: undefined as string | undefined,
}

vi.mock('@/lib/qstash', () => ({
  getQStashReceiver: mockGetQStashReceiver,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
  logError: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  get env() {
    return mockEnv
  },
}))

const makeRequest = (body: unknown, signature?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (signature) {
    headers['Upstash-Signature'] = signature
  }
  return new NextRequest('http://localhost/api/services/password-reset-email', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/services/password-reset-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetQStashReceiver.mockReturnValue({ verify: mockVerify })
    mockSendEmail.mockResolvedValue(undefined)
    mockEnv.QSTASH_CURRENT_SIGNING_KEY = undefined
    mockEnv.QSTASH_NEXT_SIGNING_KEY = undefined
  })

  it('sends password reset email for valid payload', async () => {
    const { POST } =
      await import('@/app/api/services/password-reset-email/route')

    const req = makeRequest({
      type: 'password.reset_requested',
      data: {
        to: 'user@example.com',
        customerName: 'Jane',
        resetUrl: 'http://localhost/auth/reset-password?token=a&identifier=b',
      },
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledOnce()
  })

  it('returns 401 when signature is invalid and keys are configured', async () => {
    mockEnv.QSTASH_CURRENT_SIGNING_KEY = 'current'
    mockEnv.QSTASH_NEXT_SIGNING_KEY = 'next'
    mockVerify.mockRejectedValue(new Error('invalid signature'))

    const { POST } =
      await import('@/app/api/services/password-reset-email/route')
    const req = makeRequest(
      {
        type: 'password.reset_requested',
        data: {
          to: 'user@example.com',
          customerName: 'Jane',
          resetUrl: 'http://localhost/auth/reset-password?token=a&identifier=b',
        },
      },
      'bad-signature'
    )

    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
