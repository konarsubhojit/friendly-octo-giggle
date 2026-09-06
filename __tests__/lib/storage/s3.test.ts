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

const mockNodeHttpHandler = vi.hoisted(() => vi.fn())
vi.mock('@smithy/node-http-handler', () => ({
  NodeHttpHandler: mockNodeHttpHandler,
}))

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: 'development' as 'development' | 'production' | 'test' | undefined,
  S3_REGION: 'us-east-1' as string | undefined,
  S3_BUCKET: 'test-bucket' as string | undefined,
  S3_ACCESS_KEY_ID: 'test-key-id' as string | undefined,
  S3_SECRET_ACCESS_KEY: 'test-secret' as string | undefined,
  S3_PUBLIC_BASE_URL: 'https://cdn.example.com' as string | undefined,
  S3_ENDPOINT: undefined as string | undefined,
  S3_FORCE_PATH_STYLE: undefined as string | undefined,
  S3_CA_CERT_PEM: undefined as string | undefined,
  R2_ACCOUNT_ID: 'test-account' as string | undefined,
  R2_ACCESS_KEY_ID: 'r2-key-id' as string | undefined,
  R2_SECRET_ACCESS_KEY: 'r2-secret' as string | undefined,
  R2_BUCKET: 'r2-bucket' as string | undefined,
  R2_PUBLIC_BASE_URL: 'https://r2.example.com' as string | undefined,
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.NODE_ENV = 'development'
  mockEnv.S3_REGION = 'us-east-1'
  mockEnv.S3_BUCKET = 'test-bucket'
  mockEnv.S3_ACCESS_KEY_ID = 'test-key-id'
  mockEnv.S3_SECRET_ACCESS_KEY = 'test-secret'
  mockEnv.S3_PUBLIC_BASE_URL = 'https://cdn.example.com'
  mockEnv.S3_ENDPOINT = undefined
  mockEnv.S3_FORCE_PATH_STYLE = undefined
  mockEnv.S3_CA_CERT_PEM = undefined
  mockEnv.R2_ACCOUNT_ID = 'test-account'
  mockEnv.R2_ACCESS_KEY_ID = 'r2-key-id'
  mockEnv.R2_SECRET_ACCESS_KEY = 'r2-secret'
  mockEnv.R2_BUCKET = 'r2-bucket'
  mockEnv.R2_PUBLIC_BASE_URL = 'https://r2.example.com'
  vi.resetModules()
})

describe('createS3StorageAdapter', () => {
  it('reports provider name s3', async () => {
    const { createS3StorageAdapter } = await import('@/lib/storage/s3')
    expect(createS3StorageAdapter().provider).toBe('s3')
  })

  it('builds an AWS-style client when no endpoint override is set', async () => {
    mockSend.mockResolvedValue({})
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    await createS3StorageAdapter().put('images/abc.png', Buffer.from([1]))

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        endpoint: undefined,
        forcePathStyle: false,
        credentials: {
          accessKeyId: 'test-key-id',
          secretAccessKey: 'test-secret',
        },
      })
    )
  })

  it('supports path-style MinIO-style configuration with explicit endpoint', async () => {
    mockEnv.S3_ENDPOINT = 'http://127.0.0.1:9000'
    mockEnv.S3_FORCE_PATH_STYLE = 'true'
    mockSend.mockResolvedValue({})
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    await createS3StorageAdapter().put('images/abc.png', Buffer.from([1]))

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://127.0.0.1:9000',
        forcePathStyle: true,
      })
    )
  })

  it('attaches a custom CA TLS handler when configured', async () => {
    mockEnv.S3_ENDPOINT = 'https://127.0.0.1:9000'
    mockEnv.S3_CA_CERT_PEM = '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----'
    mockSend.mockResolvedValue({})
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    await createS3StorageAdapter().put('images/abc.png', Buffer.from([1]))

    expect(mockNodeHttpHandler).toHaveBeenCalledTimes(1)
    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        requestHandler: expect.anything(),
      })
    )
  })

  it('rejects insecure HTTP endpoints in production', async () => {
    mockEnv.NODE_ENV = 'production'
    mockEnv.S3_ENDPOINT = 'http://127.0.0.1:9000'
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    await expect(
      createS3StorageAdapter().put('images/abc.png', Buffer.from([1]))
    ).rejects.toThrow(/must use HTTPS in production/)
  })

  it('put() sets content type and immutable cache control', async () => {
    mockSend.mockResolvedValue({})
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    const result = await createS3StorageAdapter().put(
      'images/abc.png',
      Buffer.from([1, 2]),
      {
        contentType: 'image/png',
      }
    )

    expect(mockPutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'images/abc.png',
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
    expect(result).toEqual({
      url: 'https://cdn.example.com/images/abc.png',
      pathname: 'images/abc.png',
      contentType: 'image/png',
      provider: 's3',
    })
  })

  it('delete() sends DeleteObjectCommand', async () => {
    mockSend.mockResolvedValue({})
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    await createS3StorageAdapter().delete('images/abc.png')

    expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'images/abc.png',
    })
  })

  it('getUrl() returns null on not-found and rethrows other errors', async () => {
    mockSend.mockRejectedValueOnce({ name: 'NotFound' }).mockRejectedValueOnce(
      new Error('network error')
    )
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    expect(await createS3StorageAdapter().getUrl('images/missing.png')).toBeNull()
    await expect(
      createS3StorageAdapter().getUrl('images/abc.png')
    ).rejects.toThrow('network error')
  })

  it('list() maps object and pagination fields', async () => {
    mockSend.mockResolvedValue({
      Contents: [
        { Key: 'images/a.png', Size: 42, LastModified: new Date('2024-01-01') },
        { Key: undefined, Size: 7 },
      ],
      NextContinuationToken: 'next-token',
      IsTruncated: true,
    })
    const { createS3StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    const result = await createS3StorageAdapter().list({ prefix: 'images/' })

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

describe('createR2StorageAdapter', () => {
  it('uses R2 account/credentials as an S3 preset and reports provider=r2', async () => {
    mockSend.mockResolvedValue({})
    const { createR2StorageAdapter, __resetS3ClientsForTests } =
      await import('@/lib/storage/s3')
    __resetS3ClientsForTests()
    const adapter = createR2StorageAdapter()
    expect(adapter.provider).toBe('r2')
    await adapter.put('images/r2.png', Buffer.from([1]))

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: 'https://test-account.r2.cloudflarestorage.com',
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'r2-key-id',
          secretAccessKey: 'r2-secret',
        },
      })
    )
  })
})
