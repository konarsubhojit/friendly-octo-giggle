import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())
const mockS3Client = vi.hoisted(() =>
  vi.fn(function MockS3Client() {
    return { send: mockSend }
  })
)
const mockPutObjectCommand = vi.hoisted(() =>
  vi.fn(function MockPutObjectCommand(input: unknown) {
    return { input, __type: 'Put' }
  })
)
const mockDeleteObjectCommand = vi.hoisted(() =>
  vi.fn(function MockDeleteObjectCommand(input: unknown) {
    return { input, __type: 'Delete' }
  })
)
const mockHeadObjectCommand = vi.hoisted(() =>
  vi.fn(function MockHeadObjectCommand(input: unknown) {
    return { input, __type: 'Head' }
  })
)
const mockListObjectsV2Command = vi.hoisted(() =>
  vi.fn(function MockListObjectsV2Command(input: unknown) {
    return { input, __type: 'List' }
  })
)

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
  PutObjectCommand: mockPutObjectCommand,
  DeleteObjectCommand: mockDeleteObjectCommand,
  HeadObjectCommand: mockHeadObjectCommand,
  ListObjectsV2Command: mockListObjectsV2Command,
}))

const mockEnv = vi.hoisted(() => ({
  R2_ACCOUNT_ID: 'test-account' as string | undefined,
  R2_ACCESS_KEY_ID: 'test-key-id' as string | undefined,
  R2_SECRET_ACCESS_KEY: 'test-secret' as string | undefined,
  R2_BUCKET: 'test-bucket' as string | undefined,
  R2_PUBLIC_BASE_URL: 'https://cdn.example.com' as string | undefined,
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.R2_ACCOUNT_ID = 'test-account'
  mockEnv.R2_ACCESS_KEY_ID = 'test-key-id'
  mockEnv.R2_SECRET_ACCESS_KEY = 'test-secret'
  mockEnv.R2_BUCKET = 'test-bucket'
  mockEnv.R2_PUBLIC_BASE_URL = 'https://cdn.example.com'
  vi.resetModules()
})

describe('createR2StorageAdapter', () => {
  it('reports its provider name', async () => {
    const { createR2StorageAdapter } = await import('@/lib/storage/r2')
    expect(createR2StorageAdapter().provider).toBe('r2')
  })

  it('constructs the S3 client with the R2 endpoint and forcePathStyle', async () => {
    mockSend.mockResolvedValue({})
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    const adapter = createR2StorageAdapter()
    await adapter.put('images/abc.png', Buffer.from([1]))

    expect(mockS3Client).toHaveBeenCalledWith({
      region: 'auto',
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'test-key-id',
        secretAccessKey: 'test-secret',
      },
    })
  })

  it('put() sends a PutObjectCommand and returns the public URL', async () => {
    mockSend.mockResolvedValue({})
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    const adapter = createR2StorageAdapter()

    const result = await adapter.put('images/abc.png', Buffer.from([1, 2]), {
      contentType: 'image/png',
    })

    expect(mockPutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'images/abc.png',
        ContentType: 'image/png',
      })
    )
    expect(result).toEqual({
      url: 'https://cdn.example.com/images/abc.png',
      pathname: 'images/abc.png',
      contentType: 'image/png',
      provider: 'r2',
    })
  })

  it('put() defaults to the immutable cache-control when none is given', async () => {
    mockSend.mockResolvedValue({})
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    await createR2StorageAdapter().put('images/abc.png', Buffer.from([1]))

    expect(mockPutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
  })

  it('put() throws a descriptive error when R2 credentials are missing', async () => {
    mockEnv.R2_ACCOUNT_ID = undefined
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    await expect(
      createR2StorageAdapter().put('images/abc.png', Buffer.from([1]))
    ).rejects.toThrow(/R2_ACCOUNT_ID/)
  })

  it('delete() sends a DeleteObjectCommand', async () => {
    mockSend.mockResolvedValue({})
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    await createR2StorageAdapter().delete('images/abc.png')

    expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'images/abc.png',
    })
  })

  it('getUrl() returns the public URL when HeadObject succeeds', async () => {
    mockSend.mockResolvedValue({})
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    const url = await createR2StorageAdapter().getUrl('images/abc.png')
    expect(url).toBe('https://cdn.example.com/images/abc.png')
  })

  it('getUrl() returns null on a NotFound error', async () => {
    mockSend.mockRejectedValue({ name: 'NotFound' })
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    const url = await createR2StorageAdapter().getUrl('images/missing.png')
    expect(url).toBeNull()
  })

  it('getUrl() returns null on a 404 metadata status', async () => {
    mockSend.mockRejectedValue({
      name: 'SomeOtherError',
      $metadata: { httpStatusCode: 404 },
    })
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    const url = await createR2StorageAdapter().getUrl('images/missing.png')
    expect(url).toBeNull()
  })

  it('getUrl() rethrows a non-not-found error', async () => {
    mockSend.mockRejectedValue(new Error('network error'))
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    await expect(
      createR2StorageAdapter().getUrl('images/abc.png')
    ).rejects.toThrow('network error')
  })

  it('list() maps R2 contents and pagination', async () => {
    mockSend.mockResolvedValue({
      Contents: [
        { Key: 'images/a.png', Size: 42, LastModified: new Date('2024-01-01') },
        { Key: undefined, Size: 1 },
      ],
      NextContinuationToken: 'next-token',
      IsTruncated: true,
    })
    const { createR2StorageAdapter, __resetR2ClientForTests } =
      await import('@/lib/storage/r2')
    __resetR2ClientForTests()
    const result = await createR2StorageAdapter().list({ prefix: 'images/' })

    expect(mockListObjectsV2Command).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: 'test-bucket', Prefix: 'images/' })
    )
    expect(result).toEqual({
      objects: [
        {
          pathname: 'images/a.png',
          size: 42,
          uploadedAt: new Date('2024-01-01'),
        },
      ],
      cursor: 'next-token',
      hasMore: true,
    })
  })
})
