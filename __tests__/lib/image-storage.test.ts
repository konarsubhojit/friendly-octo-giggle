import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetStorageAdapterFor = vi.hoisted(() => vi.fn())
const mockActiveProvider = vi.hoisted(() => ({
  value: 'vercel' as 'vercel' | 'r2' | 's3',
}))

vi.mock('@/lib/storage', () => ({
  getStorageAdapterFor: mockGetStorageAdapterFor,
  getActiveProvider: () => mockActiveProvider.value,
  IMMUTABLE_CACHE_CONTROL: 'public, max-age=31536000, immutable',
}))

const makeFile = (name = 'photo.PNG', type = 'image/png') =>
  new File([new Uint8Array([0x89, 0x50])], name, { type })

const makeAdapter = (provider: 'vercel' | 'r2' | 's3', put = vi.fn()) => ({
  provider,
  put,
  delete: vi.fn(),
  getUrl: vi.fn(),
  list: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  mockActiveProvider.value = 'vercel'
  vi.resetModules()
})

describe('uploadImage', () => {
  it('defaults to the vercel adapter when STORAGE_PROVIDER is unset', async () => {
    const put = vi.fn().mockResolvedValue({
      url: 'https://vercel.example.com/images/x.png',
      pathname: 'images/x.png',
      contentType: 'image/png',
      provider: 'vercel',
    })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', put))

    const { uploadImage } = await import('@/lib/image-storage')
    const result = await uploadImage(makeFile())

    expect(mockGetStorageAdapterFor).toHaveBeenCalledWith('vercel')
    expect(result).toEqual({
      url: 'https://vercel.example.com/images/x.png',
      pathname: 'images/x.png',
      contentType: 'image/png',
      provider: 'vercel',
    })
  })

  it('uses the r2 adapter when STORAGE_PROVIDER=r2', async () => {
    mockActiveProvider.value = 'r2'
    const put = vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/images/x.png',
      pathname: 'images/x.png',
      contentType: 'image/png',
      provider: 'r2',
    })

    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('r2', put))

    const { uploadImage } = await import('@/lib/image-storage')
    const result = await uploadImage(makeFile())

    expect(mockGetStorageAdapterFor).toHaveBeenCalledWith('r2')
    expect(result.provider).toBe('r2')
  })

  it('uses the s3 adapter when STORAGE_PROVIDER=s3', async () => {
    mockActiveProvider.value = 's3'
    const put = vi.fn().mockResolvedValue({
      url: 'https://s3.example.com/images/x.png',
      pathname: 'images/x.png',
      contentType: 'image/png',
      provider: 's3',
    })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('s3', put))

    const { uploadImage } = await import('@/lib/image-storage')
    const result = await uploadImage(makeFile())

    expect(mockGetStorageAdapterFor).toHaveBeenCalledWith('s3')
    expect(result.provider).toBe('s3')
  })

  it('lets an explicit options.provider override STORAGE_PROVIDER', async () => {
    mockActiveProvider.value = 'r2'
    const put = vi.fn().mockResolvedValue({
      url: 'https://vercel.example.com/images/x.png',
      pathname: 'images/x.png',
      contentType: 'image/png',
      provider: 'vercel',
    })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', put))

    const { uploadImage } = await import('@/lib/image-storage')
    const result = await uploadImage(makeFile(), { provider: 'vercel' })

    expect(mockGetStorageAdapterFor).toHaveBeenCalledWith('vercel')
    expect(result.provider).toBe('vercel')
  })

  it('derives a UUID-based object key that preserves a lowercased safe extension', async () => {
    const put = vi.fn().mockResolvedValue({
      url: 'https://vercel.example.com/images/x.png',
      pathname: 'images/x.png',
      contentType: 'image/png',
      provider: 'vercel',
    })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', put))

    const { uploadImage } = await import('@/lib/image-storage')
    await uploadImage(makeFile('Hello.PNG', 'image/png'))

    const [pathname] = put.mock.calls[0] as [string, unknown, unknown]
    expect(pathname).toMatch(/^images\/[0-9a-f-]+\.png$/i)
  })

  it('omits the extension when the file name has none or an unsafe one', async () => {
    const put = vi.fn().mockResolvedValue({
      url: 'https://vercel.example.com/images/x',
      pathname: 'images/x',
      contentType: null,
      provider: 'vercel',
    })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', put))

    const { uploadImage } = await import('@/lib/image-storage')

    await uploadImage(makeFile('noext', 'application/octet-stream'))
    const [pathname1] = put.mock.calls[0] as [string, unknown, unknown]
    expect(pathname1).toMatch(/^images\/[0-9a-f-]+$/i)

    put.mockClear()
    await uploadImage(makeFile('weird.<.bad>', 'application/octet-stream'))
    const [pathname2] = put.mock.calls[0] as [string, unknown, unknown]
    expect(pathname2).toMatch(/^images\/[0-9a-f-]+$/i)
  })

  it('passes the file content type and the immutable cache-control to the adapter', async () => {
    const put = vi.fn().mockResolvedValue({
      url: 'https://vercel.example.com/images/x.png',
      pathname: 'images/x.png',
      contentType: 'image/png',
      provider: 'vercel',
    })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', put))

    const { uploadImage } = await import('@/lib/image-storage')
    await uploadImage(makeFile())

    const [, , options] = put.mock.calls[0] as [
      string,
      unknown,
      { contentType: string; cacheControl: string },
    ]
    expect(options.contentType).toBe('image/png')
    expect(options.cacheControl).toBe('public, max-age=31536000, immutable')
  })

  it('defaults content type to application/octet-stream when the file has none', async () => {
    const put = vi.fn().mockResolvedValue({
      url: 'https://vercel.example.com/images/x',
      pathname: 'images/x',
      contentType: null,
      provider: 'vercel',
    })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', put))

    const { uploadImage } = await import('@/lib/image-storage')
    await uploadImage(makeFile('noext', ''))

    const [, , options] = put.mock.calls[0] as [
      string,
      unknown,
      { contentType: string },
    ]
    expect(options.contentType).toBe('application/octet-stream')
  })

  it('propagates an adapter failure', async () => {
    const put = vi.fn().mockRejectedValue(new Error('network error'))
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', put))

    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow('network error')
  })
})
