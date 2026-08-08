import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  checkAdminAuth,
  getAffinityStatus,
  dispatchWorkflowEvent,
  invalidateCache,
} = vi.hoisted(() => ({
  checkAdminAuth: vi.fn(),
  getAffinityStatus: vi.fn(),
  dispatchWorkflowEvent: vi.fn(),
  invalidateCache: vi.fn(),
}))

vi.mock('@/features/admin/services/admin-auth', () => ({ checkAdminAuth }))
vi.mock('@/features/recommendations/services/status', () => ({
  getAffinityStatus,
}))
vi.mock('@/lib/inngest/dispatch', () => ({ dispatchWorkflowEvent }))
vi.mock('@/lib/redis', () => ({ invalidateCache }))

import { GET } from '@/app/api/admin/recommendations/status/route'
import { POST } from '@/app/api/admin/recommendations/recompute/route'

const recomputeRequest = (body: unknown = {}): NextRequest =>
  new NextRequest(
    'https://localhost:3000/api/admin/recommendations/recompute',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  )

const authorized = {
  authorized: true as const,
  userId: 'admin-1',
  role: 'ADMIN',
}

beforeEach(() => {
  vi.clearAllMocks()
  checkAdminAuth.mockResolvedValue(authorized)
  getAffinityStatus.mockResolvedValue({
    lastComputedAt: '2026-08-08T04:00:00.000Z',
    pairCount: 120,
    anchorCount: 30,
    windowDays: 180,
    minSupport: 3,
  })
  dispatchWorkflowEvent.mockResolvedValue('published')
  invalidateCache.mockResolvedValue(undefined)
})

describe('GET /api/admin/recommendations/status', () => {
  it('returns 401 without a session', async () => {
    checkAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    })

    expect((await GET()).status).toBe(401)
  })

  it('returns 403 for a session without system:manage', async () => {
    checkAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Forbidden',
      status: 403,
    })

    expect((await GET()).status).toBe(403)
  })

  it('reports the last refresh and the active thresholds', async () => {
    const body = await (await GET()).json()

    expect(body.data).toEqual({
      lastComputedAt: '2026-08-08T04:00:00.000Z',
      pairCount: 120,
      anchorCount: 30,
      windowDays: 180,
      minSupport: 3,
    })
  })

  it('requires the system:manage permission specifically', async () => {
    await GET()

    expect(checkAdminAuth).toHaveBeenCalledWith('system:manage')
  })
})

describe('POST /api/admin/recommendations/recompute', () => {
  it('returns 401 without a session', async () => {
    checkAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    })

    expect((await POST(recomputeRequest())).status).toBe(401)
  })

  it('returns 403 for a session without system:manage', async () => {
    checkAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Forbidden',
      status: 403,
    })

    expect((await POST(recomputeRequest())).status).toBe(403)
  })

  it('accepts the trigger with 202 and reports how it was dispatched', async () => {
    const response = await POST(recomputeRequest())
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.data).toEqual({ accepted: true, dispatch: 'published' })
  })

  it('publishes the same event the cron trigger fires', async () => {
    await POST(recomputeRequest())

    expect(dispatchWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          name: 'recommendations/affinity.recompute',
        }),
      })
    )
  })

  it('records which admin triggered the run', async () => {
    await POST(recomputeRequest())

    const [{ event }] = dispatchWorkflowEvent.mock.calls[0]
    expect(event.data.triggeredBy).toBe('admin-1')
  })

  it('reports a dropped dispatch as not accepted, so an unconfigured environment is visible', async () => {
    dispatchWorkflowEvent.mockResolvedValue('dropped')

    const body = await (await POST(recomputeRequest())).json()

    expect(body.data).toEqual({ accepted: false, dispatch: 'dropped' })
  })

  it('rejects an out-of-range window rather than queueing it', async () => {
    const response = await POST(recomputeRequest({ windowDays: 5000 }))

    expect(response.status).toBe(400)
    expect(dispatchWorkflowEvent).not.toHaveBeenCalled()
  })

  it('drops the cached status so the admin sees the new run rather than a stale snapshot', async () => {
    await POST(recomputeRequest())

    expect(invalidateCache).toHaveBeenCalledWith('recommendations:status')
  })
})
