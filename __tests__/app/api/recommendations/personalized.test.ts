import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { auth, getHomeRail, resolveBestsellerFallback, selectRows } = vi.hoisted(
  () => ({
    auth: vi.fn(),
    getHomeRail: vi.fn(),
    resolveBestsellerFallback: vi.fn(),
    selectRows: vi.fn(),
  })
)

vi.mock('@/lib/auth', () => ({ auth }))
vi.mock('@/features/recommendations/services/selection', () => ({
  getHomeRail,
  resolveBestsellerFallback,
}))
vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          orderBy: () => ({ limit: () => selectRows() }),
        }),
        where: () => ({
          orderBy: () => ({ limit: () => selectRows() }),
        }),
      }),
    }),
  },
  primaryDrizzleDb: {},
}))

import { GET } from '@/app/api/recommendations/personalized/route'

const request = (query = ''): NextRequest =>
  new NextRequest(
    `https://localhost:3000/api/recommendations/personalized${query}`
  )

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue(null)
  resolveBestsellerFallback.mockResolvedValue([])
  getHomeRail.mockResolvedValue({
    surface: 'home',
    fallback: false,
    products: [],
  })
  selectRows.mockResolvedValue([])
})

describe('GET /api/recommendations/personalized', () => {
  it('answers a guest from bestsellers without any per-user read', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.fallback).toBe(true)
    expect(resolveBestsellerFallback).toHaveBeenCalled()
    // The guest branch returns before the personalised path is reachable.
    expect(getHomeRail).not.toHaveBeenCalled()
    expect(selectRows).not.toHaveBeenCalled()
  })

  it('never returns 401, because a rail must not be why a page errors', async () => {
    const response = await GET(request())

    expect(response.status).not.toBe(401)
  })

  it('does not key a guest response to any identifier', async () => {
    const response = await GET(request('?seeds=aaaaaaa'))

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
  })

  it('marks an authenticated response private so it is never shared', async () => {
    auth.mockResolvedValue({ user: { id: 'user-1' } })

    const response = await GET(request())

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('unions the supplied seeds with the shopper own history anchors', async () => {
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    selectRows.mockResolvedValue([{ productId: 'ccccccc' }])

    await GET(request('?seeds=aaaaaaa,bbbbbbb'))

    const [anchors] = getHomeRail.mock.calls[0]
    expect(anchors).toEqual(expect.arrayContaining(['aaaaaaa', 'bbbbbbb']))
  })

  it('rejects a malformed seed rather than querying with it', async () => {
    const response = await GET(request('?seeds=too-long-to-be-a-short-id'))

    expect(response.status).toBe(400)
    expect(getHomeRail).not.toHaveBeenCalled()
  })

  it('rejects more seeds than the client is allowed to hold', async () => {
    const seeds = Array.from(
      { length: 13 },
      (_, i) => `p${String(i).padStart(6, '0')}`
    ).join(',')

    const response = await GET(request(`?seeds=${seeds}`))

    expect(response.status).toBe(400)
  })

  it('rejects an out-of-range limit', async () => {
    const response = await GET(request('?limit=500'))

    expect(response.status).toBe(400)
  })
})
