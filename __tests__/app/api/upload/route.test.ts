import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/upload/route'
import { auth } from '@/lib/auth'
import { uploadImage } from '@/lib/image-storage'
import {
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import { logError } from '@/lib/logger'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/image-storage', () => ({ uploadImage: vi.fn() }))
vi.mock(
  '@/lib/upload-constants',
  async () => await vi.importActual('@/lib/upload-constants')
)
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockUploadImage = uploadImage as ReturnType<typeof vi.fn>

const PNG_MAGIC_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
])

interface RequestOptions {
  readonly contentLength?: number
  readonly formDataImpl?: () => Promise<{ get: (key: string) => unknown }>
}

const createFile = ({
  name = 'test.png',
  type = 'image/png',
  bytes = PNG_MAGIC_BYTES,
}: {
  readonly name?: string
  readonly type?: string
  readonly bytes?: Uint8Array
} = {}): File => {
  const normalizedBytes = Uint8Array.from(bytes)
  return new File([normalizedBytes], name, { type })
}

function makeRequest(
  file?: File | null,
  extras: Record<string, unknown> = {},
  options: RequestOptions = {}
): Request {
  const mockFormData = new Map<string, unknown>()
  if (file) {
    mockFormData.set('file', file)
  }
  for (const [key, value] of Object.entries(extras)) {
    mockFormData.set(key, value)
  }
  const formData =
    options.formDataImpl ??
    (async () => ({
      get: (key: string) => mockFormData.get(key) ?? null,
    }))
  return {
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-length' &&
        typeof options.contentLength === 'number'
          ? String(options.contentLength)
          : null,
    },
    formData,
  } as unknown as Request
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
      makeRequest(
        createFile({
          name: 'renamed.jpg',
          type: 'image/jpeg',
          bytes: new TextEncoder().encode('<?php echo "pwned"; ?>'),
        })
      )
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(
      `Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`
    )
  })

  it('returns 400 when SVG content is uploaded with an image MIME type', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const svgPayload = new TextEncoder().encode(
      '<svg><script>alert(1)</script></svg>'
    )
    const res = await POST(
      makeRequest(
        createFile({
          name: 'avatar.jpg',
          type: 'image/jpeg',
          bytes: svgPayload,
        })
      )
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(
      `Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`
    )
  })

  it('returns 400 when PNG payload has only a spoofed 4-byte signature prefix', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const spoofedPngPrefix = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44,
    ])

    const res = await POST(
      makeRequest(
        createFile({
          name: 'spoofed.png',
          type: 'image/png',
          bytes: spoofedPngPrefix,
        })
      )
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
      makeRequest(
        createFile({
          name: 'big.png',
          type: 'image/png',
          bytes: new Uint8Array(MAX_FILE_SIZE + 1),
        })
      )
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    )
  })

  it('returns 413 when content-length exceeds the maximum body size', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const formDataSpy = vi.fn(async () => ({
      get: () => null,
    }))

    const res = await POST(
      makeRequest(
        createFile(),
        {},
        {
          contentLength: MAX_FILE_SIZE + 2 * 1024 * 1024,
          formDataImpl: formDataSpy,
        }
      )
    )

    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toContain('Request body too large')
    expect(formDataSpy).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid provider', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const file = createFile()
    const res = await POST(makeRequest(file, { provider: 'gcs' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid provider. Expected "vercel" or "azure".')
    expect(mockUploadImage).not.toHaveBeenCalled()
  })

  it('uploads successfully via Vercel (default)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const uploadResult = {
      url: 'https://blob.vercel-storage.com/test.png',
      pathname: 'test.png',
      contentType: 'image/png',
      provider: 'vercel' as const,
    }
    mockUploadImage.mockResolvedValue(uploadResult)
    const file = createFile({
      name: 'original-name.php',
      type: 'image/jpeg',
      bytes: PNG_MAGIC_BYTES,
    })
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('generated-uuid')
    const res = await POST(makeRequest(file))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({
      url: uploadResult.url,
      pathname: uploadResult.pathname,
      contentType: uploadResult.contentType,
      provider: 'vercel',
      azureAccountAlias: null,
    })
    expect(mockUploadImage).toHaveBeenCalledWith(expect.any(File), {
      provider: undefined,
      azureAccountAlias: undefined,
    })
    const [uploadedFile] = mockUploadImage.mock.calls[0] as [File]
    expect(uploadedFile.name).toBe('generated-uuid.png')
    expect(uploadedFile.type).toBe('image/png')
  })

  it('uploads successfully via Azure with alias', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const uploadResult = {
      url: 'https://acct.blob.core.windows.net/container/images/abc.png',
      pathname: 'images/abc.png',
      contentType: 'image/png',
      provider: 'azure' as const,
      azureAccountAlias: 'primary',
    }
    mockUploadImage.mockResolvedValue(uploadResult)
    const file = createFile()
    const res = await POST(
      makeRequest(file, { provider: 'azure', azureAccountAlias: 'primary' })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({
      url: uploadResult.url,
      pathname: uploadResult.pathname,
      contentType: uploadResult.contentType,
      provider: 'azure',
      azureAccountAlias: 'primary',
    })
    expect(mockUploadImage).toHaveBeenCalledWith(expect.any(File), {
      provider: 'azure',
      azureAccountAlias: 'primary',
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

  it('returns 500 and logs context when uploadImage rejects with default provider', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-123', role: 'ADMIN' } })
    mockUploadImage.mockRejectedValue(new Error('upload failed'))
    const file = createFile({ name: 'fail.png' })
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('generated-uuid')

    const res = await POST(makeRequest(file))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to upload file')
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        context: 'file_upload',
        additionalInfo: expect.objectContaining({
          fileName: 'generated-uuid.png',
          userId: 'user-123',
          // No provider input → route leaves provider as 'unknown' before upload
          provider: 'unknown',
          azureAccountAlias: 'unknown',
        }),
      })
    )
  })

  it('returns 500 and logs context when uploadImage rejects with explicit azure provider + alias', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-456', role: 'ADMIN' } })
    mockUploadImage.mockRejectedValue(new Error('upload failed'))
    const file = createFile({ name: 'fail-azure.png' })
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('generated-uuid')

    const res = await POST(
      makeRequest(file, { provider: 'azure', azureAccountAlias: 'images-west' })
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to upload file')
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        context: 'file_upload',
        additionalInfo: expect.objectContaining({
          fileName: 'generated-uuid.png',
          userId: 'user-456',
          provider: 'azure',
          // alias is only captured into the log context after a successful upload;
          // when uploadImage throws, it remains at its pre-upload default.
          azureAccountAlias: 'unknown',
        }),
      })
    )
  })

  const magicBytesFor = (signature: number[]): Uint8Array =>
    Uint8Array.from([...signature, ...Array(16 - signature.length).fill(0)])

  it.each([
    ['JPEG', [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0], 'image/jpeg', 'jpg'],
    [
      'GIF87a',
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0, 0, 0, 0, 0],
      'image/gif',
      'gif',
    ],
    [
      'GIF89a',
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0],
      'image/gif',
      'gif',
    ],
    [
      'WEBP',
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      'image/webp',
      'webp',
    ],
  ])(
    'accepts %s payloads',
    async (_label, signature, mimeType, extension) => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
      mockUploadImage.mockResolvedValue({
        url: 'https://blob/test',
        pathname: 'test',
        contentType: mimeType as string,
        provider: 'vercel' as const,
      })
      vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-1')

      const res = await POST(
        makeRequest(
          createFile({ bytes: magicBytesFor(signature as number[]) })
        )
      )

      expect(res.status).toBe(200)
      const [uploadedFile] = mockUploadImage.mock.calls[0] as [File]
      expect(uploadedFile.name).toBe(`uuid-1.${extension}`)
      expect(uploadedFile.type).toBe(mimeType)
    }
  )

  it('rejects payloads shorter than the magic byte window', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })

    const res = await POST(
      makeRequest(createFile({ bytes: Uint8Array.from([0x89, 0x50]) }))
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain(VALID_IMAGE_TYPES_DISPLAY)
  })

  it('rejects a blank azure account alias', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })

    const res = await POST(
      makeRequest(createFile(), { azureAccountAlias: '   ' })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('azureAccountAlias')
  })

  it('treats a null azure account alias as absent', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    mockUploadImage.mockResolvedValue({
      url: 'https://blob/test',
      pathname: 'test',
      contentType: 'image/png',
      provider: 'vercel' as const,
    })

    const res = await POST(
      makeRequest(createFile(), { azureAccountAlias: null })
    )

    expect(res.status).toBe(200)
  })

  it('ignores an unparseable content-length header', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    mockUploadImage.mockResolvedValue({
      url: 'https://blob/test',
      pathname: 'test',
      contentType: 'image/png',
      provider: 'vercel' as const,
    })

    const request = {
      headers: { get: () => 'not-a-number' },
      formData: async () => ({
        get: (key: string) => (key === 'file' ? createFile() : null),
      }),
    } as unknown as Request

    const res = await POST(request)

    expect(res.status).toBe(200)
  })
})
