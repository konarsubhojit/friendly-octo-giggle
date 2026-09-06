import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockAuth,
  mockSelect,
  mockInsert,
  mockUploadImage,
  mockCountOrphanedEvidence,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUploadImage: vi.fn(),
  mockCountOrphanedEvidence: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { select: mockSelect, insert: mockInsert },
}))

vi.mock('@/lib/image-storage', () => ({ uploadImage: mockUploadImage }))

vi.mock('@/features/orders/services/return-service', () => ({
  countOrphanedEvidence: mockCountOrphanedEvidence,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { POST } from '@/app/api/orders/[id]/returns/evidence/route'
import { RETURN_EVIDENCE_MAX } from '@/lib/constants/returns'
import { INSTAGRAM_HANDLE } from '@/lib/constants/store'

const params = Promise.resolve({ id: 'ORD1234567' })

const chainResolving = (rows: unknown[]) => {
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'limit', 'values', 'returning']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.then = (resolve: (value: unknown) => unknown) => resolve(rows)
  return chain
}

/** A real PNG: the first eight bytes are the PNG magic-byte signature. */
const pngFile = (name = 'damage.png', padding = 64) => {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const bytes = new Uint8Array([...magic, ...new Array(padding).fill(0)])
  return new File([bytes], name, { type: 'image/png' })
}

/** A file that claims to be a PNG but is not — the magic-byte check must catch it. */
const spoofedFile = () =>
  new File([new Uint8Array(64).fill(0x41)], 'payload.png', {
    type: 'image/png',
  })

const uploadRequest = (file: File | null, headers: HeadersInit = {}) => {
  const body = new FormData()
  if (file) body.append('file', file)
  return new NextRequest(
    'https://localhost/api/orders/ORD1234567/returns/evidence',
    { method: 'POST', body, headers }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  mockSelect.mockReturnValue(
    chainResolving([{ id: 'ORD1234567', userId: 'user-1' }])
  )
  mockInsert.mockReturnValue(chainResolving([{ id: 'evidAAA' }]))
  mockCountOrphanedEvidence.mockResolvedValue(0)
  mockUploadImage.mockResolvedValue({
    url: 'https://blob.example/damage.png',
    pathname: 'damage.png',
    contentType: 'image/png',
    provider: 'vercel',
  })
})

describe('POST /api/orders/[id]/returns/evidence', () => {
  it('refuses an anonymous caller', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST(uploadRequest(pngFile()), { params })

    expect(response.status).toBe(401)
    expect(mockUploadImage).not.toHaveBeenCalled()
  })

  it('reports another customer’s order as missing, not forbidden', async () => {
    mockSelect.mockReturnValue(chainResolving([]))

    const response = await POST(uploadRequest(pngFile()), { params })

    expect(response.status).toBe(404)
  })

  it('rejects an oversized body before reading it', async () => {
    // Reading a 500MB body into memory to then reject it is the denial of
    // service this guard exists to prevent.
    const response = await POST(
      uploadRequest(pngFile(), {
        'content-length': String(500 * 1024 * 1024),
      }),
      { params }
    )

    expect(response.status).toBe(413)
    expect(mockUploadImage).not.toHaveBeenCalled()
  })

  it('rejects a file whose magic bytes do not match its declared type', async () => {
    // A declared content type is attacker-controlled; the leading bytes are
    // the only trustworthy signal of what was actually uploaded.
    const response = await POST(uploadRequest(spoofedFile()), { params })

    expect(response.status).toBe(400)
    expect(mockUploadImage).not.toHaveBeenCalled()
  })

  it('points a video upload at Instagram rather than a bare type error', async () => {
    const video = new File([new Uint8Array(64)], 'damage.mp4', {
      type: 'video/mp4',
    })

    const response = await POST(uploadRequest(video), { params })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain(INSTAGRAM_HANDLE)
  })

  it('requires a file', async () => {
    const response = await POST(uploadRequest(null), { params })

    expect(response.status).toBe(400)
  })

  it(`refuses upload number ${RETURN_EVIDENCE_MAX + 1}`, async () => {
    mockCountOrphanedEvidence.mockResolvedValue(RETURN_EVIDENCE_MAX)

    const response = await POST(uploadRequest(pngFile()), { params })

    expect(response.status).toBe(409)
    expect(mockUploadImage).not.toHaveBeenCalled()
  })

  it('stores an orphaned row scoped to the user and order', async () => {
    // `returnRequestId` stays null until the claim attaches it, so ownership
    // has to be carried on the evidence row itself.
    let stored: Record<string, unknown> | undefined
    const chain: Record<string, unknown> = {}
    chain.values = vi.fn((value: Record<string, unknown>) => {
      stored = value
      return chain
    })
    chain.returning = vi.fn(() => chain)
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve([{ id: 'evidAAA' }])
    mockInsert.mockReturnValue(chain)

    const response = await POST(uploadRequest(pngFile()), { params })

    expect(response.status).toBe(201)
    expect(stored).toMatchObject({
      returnRequestId: null,
      userId: 'user-1',
      orderId: 'ORD1234567',
    })
  })

  it('never lets an evidence response be cached', async () => {
    const response = await POST(uploadRequest(pngFile()), { params })

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
