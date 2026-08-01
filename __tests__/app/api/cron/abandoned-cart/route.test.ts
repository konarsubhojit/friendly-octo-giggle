import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockProcessAbandonedCartReminders = vi.fn()

vi.mock('@/features/cart/services/abandoned-cart-service', () => ({
  processAbandonedCartReminders: (...args: unknown[]) =>
    mockProcessAbandonedCartReminders(...args),
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

import { GET } from '@/app/api/cron/abandoned-cart/route'

const buildCronRequest = (hasCronHeader = true): NextRequest => {
  const request = new NextRequest(
    'http://localhost:3000/api/cron/abandoned-cart'
  )
  if (hasCronHeader) {
    Object.defineProperty(request, 'headers', {
      value: new Headers({ 'user-agent': 'vercel-cron/1.0' }),
    })
  }
  return request
}

describe('GET /api/cron/abandoned-cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 for non-cron requests', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/cron/abandoned-cart',
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
      'http://localhost:3000/api/cron/abandoned-cart',
      { headers: { authorization: 'Bearer test-secret' } }
    )
    mockProcessAbandonedCartReminders.mockResolvedValue({
      firstReminders: 0,
      secondReminders: 0,
      errors: 0,
      results: [],
    })
    const res = await GET(request)
    expect(res.status).toBe(200)
  })

  it('returns 200 with zero counts when no eligible carts exist', async () => {
    mockProcessAbandonedCartReminders.mockResolvedValue({
      firstReminders: 0,
      secondReminders: 0,
      errors: 0,
      results: [],
    })
    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.firstReminders).toBe(0)
    expect(body.data.secondReminders).toBe(0)
  })

  it('returns reminder counts when reminders were sent', async () => {
    mockProcessAbandonedCartReminders.mockResolvedValue({
      firstReminders: 3,
      secondReminders: 1,
      errors: 0,
      results: [
        { cartId: 'abc1234', userId: 'u1', reminderNumber: 1, success: true },
        { cartId: 'abc1235', userId: 'u2', reminderNumber: 1, success: true },
        { cartId: 'abc1236', userId: 'u3', reminderNumber: 1, success: true },
        { cartId: 'abc1237', userId: 'u4', reminderNumber: 2, success: true },
      ],
    })
    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.firstReminders).toBe(3)
    expect(body.data.secondReminders).toBe(1)
    expect(body.data.errors).toBe(0)
  })

  it('returns 500 when processAbandonedCartReminders throws', async () => {
    mockProcessAbandonedCartReminders.mockRejectedValue(
      new Error('DB connection failed')
    )
    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(500)
  })

  it('includes error count in response when some sends failed', async () => {
    mockProcessAbandonedCartReminders.mockResolvedValue({
      firstReminders: 1,
      secondReminders: 0,
      errors: 2,
      results: [
        { cartId: 'abc1234', userId: 'u1', reminderNumber: 1, success: true },
        {
          cartId: 'abc1235',
          userId: 'u2',
          reminderNumber: 1,
          success: false,
          error: 'email_send_failed',
        },
        {
          cartId: 'abc1236',
          userId: 'u3',
          reminderNumber: 1,
          success: false,
          error: 'user_not_found',
        },
      ],
    })
    const request = buildCronRequest()
    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.errors).toBe(2)
  })
})
