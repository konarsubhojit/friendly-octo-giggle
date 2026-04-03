import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetRetriableFailedEmails = vi.fn()
const mockRetryFailedEmail = vi.fn()

vi.mock('@/lib/email/failed-emails', () => ({
  getRetriableFailedEmails: (...args: unknown[]) =>
    mockGetRetriableFailedEmails(...args),
  retryFailedEmail: (...args: unknown[]) => mockRetryFailedEmail(...args),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
  logCacheOperation: vi.fn(),
  Timer: class {
    end() {}
  },
}))

import { GET } from '@/app/api/cron/retry-emails/route'

const buildCronRequest = (hasCronHeader = true): NextRequest => {
  const request = new NextRequest('http://localhost:3000/api/cron/retry-emails')
  if (hasCronHeader) {
    Object.defineProperty(request, 'headers', {
      value: new Headers({ 'user-agent': 'vercel-cron/1.0' }),
    })
  }
  return request
}

describe('GET /api/cron/retry-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 for non-cron requests', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/cron/retry-emails',
      { headers: { 'user-agent': 'Mozilla/5.0' } }
    )
    const res = await GET(request)
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET is set but authorization header is missing', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(401)
  })

  it('allows request when CRON_SECRET matches authorization header', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const request = new NextRequest(
      'http://localhost:3000/api/cron/retry-emails',
      { headers: { authorization: 'Bearer test-secret' } }
    )
    mockGetRetriableFailedEmails.mockResolvedValue([])
    const res = await GET(request)
    expect(res.status).toBe(200)
  })

  it('returns success with 0 retried when no retriable emails exist', async () => {
    mockGetRetriableFailedEmails.mockResolvedValue([])
    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.retried).toBe(0)
  })

  it('retries retriable emails and returns results', async () => {
    mockGetRetriableFailedEmails.mockResolvedValue([
      { id: 'abc1234', recipientEmail: 'test@example.com' },
      { id: 'def5678', recipientEmail: 'user@example.com' },
    ])
    mockRetryFailedEmail
      .mockResolvedValueOnce({ id: 'abc1234', success: true })
      .mockResolvedValueOnce({
        id: 'def5678',
        success: false,
        error: 'SMTP error',
      })

    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.retried).toBe(2)
    expect(body.data.succeeded).toBe(1)
    expect(body.data.failed).toBe(1)
  })

  it('returns 500 when an unexpected error occurs', async () => {
    mockGetRetriableFailedEmails.mockRejectedValue(
      new Error('DB connection failed')
    )
    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(500)
  })
})
