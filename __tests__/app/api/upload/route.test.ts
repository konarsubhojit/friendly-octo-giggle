import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/upload/route'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'
import {
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import { logError } from '@/lib/logger'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock(
  '@/lib/upload-constants',
  async () => await vi.importActual('@/lib/upload-constants')
)
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockPut = put as ReturnType<typeof vi.fn>

function makeRequest(
  file?: { name: string; type: string; size: number } | null
): Request {
  const mockFormData = new Map<string, unknown>()
  if (file) {
    mockFormData.set('file', {
      name: file.name,
      type: file.type,
      size: file.size,
    })
  }
  return {
    formData: async () => ({
      get: (key: string) => mockFormData.get(key) ?? null,
    }),
  } as unknown as Request
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 403 when not admin', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'USER' } })
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Not authorized - Admin access required')
  })

  it('returns 400 when no file provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No file provided')
  })

  it('returns 400 for invalid file type', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const res = await POST(
      makeRequest({ name: 'test.txt', type: 'text/plain', size: 100 })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(
      `Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`
    )
  })

  it('returns 400 for file too large', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const res = await POST(
      makeRequest({
        name: 'big.png',
        type: 'image/png',
        size: 6 * 1024 * 1024,
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    )
  })

  it('uploads successfully', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const blobResult = {
      url: 'https://blob.vercel-storage.com/test.png',
      pathname: 'test.png',
      contentType: 'image/png',
    }
    mockPut.mockResolvedValue(blobResult)
    const file = { name: 'test.png', type: 'image/png', size: 1024 }
    const res = await POST(makeRequest(file))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({
      url: blobResult.url,
      pathname: blobResult.pathname,
      contentType: blobResult.contentType,
    })
    expect(mockPut).toHaveBeenCalledWith('test.png', file, {
      access: 'public',
      addRandomSuffix: true,
    })
  })

  it('returns 500 on error', async () => {
    mockAuth.mockRejectedValue(new Error('boom'))
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to upload file')
    expect(logError).toHaveBeenCalled()
  })
})
