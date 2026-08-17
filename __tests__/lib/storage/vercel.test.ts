import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPut = vi.hoisted(() => vi.fn())
const mockDel = vi.hoisted(() => vi.fn())
const mockHead = vi.hoisted(() => vi.fn())
const mockList = vi.hoisted(() => vi.fn())

class MockBlobNotFoundError extends Error {}

vi.mock('@vercel/blob', () => ({
  put: mockPut,
  del: mockDel,
  head: mockHead,
  list: mockList,
  BlobNotFoundError: MockBlobNotFoundError,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createVercelStorageAdapter', () => {
  it('reports its provider name', async () => {
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    expect(createVercelStorageAdapter().provider).toBe('vercel')
  })

  it('put() disables the random suffix and applies immutable cache-control', async () => {
    mockPut.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/images/abc.png',
      pathname: 'images/abc.png',
      contentType: 'image/png',
    })
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    const adapter = createVercelStorageAdapter()
    const body = Buffer.from([1, 2, 3])

    const result = await adapter.put('images/abc.png', body, {
      contentType: 'image/png',
    })

    expect(mockPut).toHaveBeenCalledWith(
      'images/abc.png',
      body,
      expect.objectContaining({
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/png',
        cacheControlMaxAge: 31536000,
      })
    )
    expect(result).toEqual({
      url: 'https://blob.vercel-storage.com/images/abc.png',
      pathname: 'images/abc.png',
      contentType: 'image/png',
      provider: 'vercel',
    })
  })

  it('put() wraps a raw Uint8Array body in a Buffer', async () => {
    mockPut.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/images/abc.png',
      pathname: 'images/abc.png',
      contentType: null,
    })
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    const adapter = createVercelStorageAdapter()
    const body = new Uint8Array([9, 9, 9])

    await adapter.put('images/abc.png', body)

    const [, calledBody] = mockPut.mock.calls[0] as [string, unknown]
    expect(Buffer.isBuffer(calledBody)).toBe(true)
  })

  it('delete() forwards the pathname', async () => {
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    await createVercelStorageAdapter().delete('images/abc.png')
    expect(mockDel).toHaveBeenCalledWith('images/abc.png')
  })

  it('getUrl() returns the head URL when the object exists', async () => {
    mockHead.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/images/abc.png',
    })
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    const url = await createVercelStorageAdapter().getUrl('images/abc.png')
    expect(url).toBe('https://blob.vercel-storage.com/images/abc.png')
  })

  it('getUrl() returns null when the object is missing', async () => {
    mockHead.mockRejectedValue(new MockBlobNotFoundError('not found'))
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    const url = await createVercelStorageAdapter().getUrl('images/missing.png')
    expect(url).toBeNull()
  })

  it('getUrl() rethrows a non-not-found error', async () => {
    mockHead.mockRejectedValue(new Error('network error'))
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    await expect(
      createVercelStorageAdapter().getUrl('images/abc.png')
    ).rejects.toThrow('network error')
  })

  it('list() maps blobs and forwards pagination options', async () => {
    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'images/a.png',
          size: 10,
          uploadedAt: new Date('2024-01-01'),
        },
      ],
      cursor: 'next-cursor',
      hasMore: true,
    })
    const { createVercelStorageAdapter } = await import('@/lib/storage/vercel')
    const result = await createVercelStorageAdapter().list({
      prefix: 'images/',
      limit: 50,
      cursor: 'prev-cursor',
    })

    expect(mockList).toHaveBeenCalledWith({
      prefix: 'images/',
      limit: 50,
      cursor: 'prev-cursor',
    })
    expect(result).toEqual({
      objects: [
        {
          pathname: 'images/a.png',
          size: 10,
          uploadedAt: new Date('2024-01-01'),
        },
      ],
      cursor: 'next-cursor',
      hasMore: true,
    })
  })
})
