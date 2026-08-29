import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateVercelAdapter = vi.hoisted(() => vi.fn())
const mockCreateR2Adapter = vi.hoisted(() => vi.fn())
const mockCreateS3Adapter = vi.hoisted(() => vi.fn())
const mockLoggerWarn = vi.hoisted(() => vi.fn())
const mockLoggerError = vi.hoisted(() => vi.fn())

const mockEnv = vi.hoisted(() => ({
  STORAGE_PROVIDER: undefined as string | undefined,
  STORAGE_FALLBACK_PROVIDERS: undefined as string | undefined,
  STORAGE_FALLBACK_VERCEL: undefined as string | undefined,
  STORAGE_FALLBACK_R2: undefined as string | undefined,
  STORAGE_FALLBACK_S3: undefined as string | undefined,
  S3_REGION: undefined as string | undefined,
  S3_BUCKET: undefined as string | undefined,
  S3_ACCESS_KEY_ID: undefined as string | undefined,
  S3_SECRET_ACCESS_KEY: undefined as string | undefined,
  S3_PUBLIC_BASE_URL: undefined as string | undefined,
  R2_ACCOUNT_ID: undefined as string | undefined,
  R2_ACCESS_KEY_ID: undefined as string | undefined,
  R2_SECRET_ACCESS_KEY: undefined as string | undefined,
  R2_BUCKET: undefined as string | undefined,
  R2_PUBLIC_BASE_URL: undefined as string | undefined,
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))
vi.mock('@/lib/logger', () => ({
  logger: { warn: mockLoggerWarn, error: mockLoggerError },
}))
vi.mock('@/lib/storage/vercel', () => ({
  createVercelStorageAdapter: mockCreateVercelAdapter,
}))
vi.mock('@/lib/storage/r2', () => ({
  createR2StorageAdapter: mockCreateR2Adapter,
}))
vi.mock('@/lib/storage/s3', () => ({
  createS3StorageAdapter: mockCreateS3Adapter,
}))

const makeAdapter = (provider: 'vercel' | 'r2' | 's3', getUrl = vi.fn()) => ({
  provider,
  put: vi.fn(),
  delete: vi.fn(),
  getUrl,
  list: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.STORAGE_PROVIDER = undefined
  mockEnv.STORAGE_FALLBACK_PROVIDERS = undefined
  mockEnv.STORAGE_FALLBACK_VERCEL = undefined
  mockEnv.STORAGE_FALLBACK_R2 = undefined
  mockEnv.STORAGE_FALLBACK_S3 = undefined
  mockEnv.S3_REGION = undefined
  mockEnv.S3_BUCKET = undefined
  mockEnv.S3_ACCESS_KEY_ID = undefined
  mockEnv.S3_SECRET_ACCESS_KEY = undefined
  mockEnv.S3_PUBLIC_BASE_URL = undefined
  mockEnv.R2_ACCOUNT_ID = undefined
  mockEnv.R2_ACCESS_KEY_ID = undefined
  mockEnv.R2_SECRET_ACCESS_KEY = undefined
  mockEnv.R2_BUCKET = undefined
  mockEnv.R2_PUBLIC_BASE_URL = undefined
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
  vi.resetModules()
})

describe('getActiveProvider', () => {
  it('defaults to vercel when STORAGE_PROVIDER is unset', async () => {
    const { getActiveProvider } = await import('@/lib/storage')
    expect(getActiveProvider()).toBe('vercel')
  })

  it('is r2 when STORAGE_PROVIDER=r2', async () => {
    mockEnv.STORAGE_PROVIDER = 'r2'
    mockEnv.R2_ACCOUNT_ID = 'acct'
    mockEnv.R2_ACCESS_KEY_ID = 'ak'
    mockEnv.R2_SECRET_ACCESS_KEY = 'sk'
    mockEnv.R2_BUCKET = 'bucket'
    mockEnv.R2_PUBLIC_BASE_URL = 'https://r2.example.com'
    const { getActiveProvider } = await import('@/lib/storage')
    expect(getActiveProvider()).toBe('r2')
  })

  it('is s3 when STORAGE_PROVIDER=s3', async () => {
    mockEnv.STORAGE_PROVIDER = 's3'
    mockEnv.S3_REGION = 'us-east-1'
    mockEnv.S3_BUCKET = 'bucket'
    mockEnv.S3_ACCESS_KEY_ID = 'ak'
    mockEnv.S3_SECRET_ACCESS_KEY = 'sk'
    mockEnv.S3_PUBLIC_BASE_URL = 'https://s3.example.com'
    const { getActiveProvider } = await import('@/lib/storage')
    expect(getActiveProvider()).toBe('s3')
  })
})

describe('getStorageAdapterFor', () => {
  it('memoizes the vercel adapter across calls', async () => {
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel'))
    const { getStorageAdapterFor } = await import('@/lib/storage')

    const first = getStorageAdapterFor('vercel')
    const second = getStorageAdapterFor('vercel')

    expect(first).toBe(second)
    expect(mockCreateVercelAdapter).toHaveBeenCalledTimes(1)
  })

  it('memoizes the r2 adapter across calls', async () => {
    mockCreateR2Adapter.mockReturnValue(makeAdapter('r2'))
    const { getStorageAdapterFor } = await import('@/lib/storage')

    const first = getStorageAdapterFor('r2')
    const second = getStorageAdapterFor('r2')

    expect(first).toBe(second)
    expect(mockCreateR2Adapter).toHaveBeenCalledTimes(1)
  })

  it('memoizes the s3 adapter across calls', async () => {
    mockCreateS3Adapter.mockReturnValue(makeAdapter('s3'))
    const { getStorageAdapterFor } = await import('@/lib/storage')

    const first = getStorageAdapterFor('s3')
    const second = getStorageAdapterFor('s3')

    expect(first).toBe(second)
    expect(mockCreateS3Adapter).toHaveBeenCalledTimes(1)
  })
})

describe('resolveStorageUrl', () => {
  it('returns the primary provider URL without any fallback or logging', async () => {
    mockEnv.STORAGE_PROVIDER = 'r2'
    const r2GetUrl = vi.fn().mockResolvedValue('https://r2.example.com/x.png')
    const vercelGetUrl = vi.fn()
    mockCreateR2Adapter.mockReturnValue(makeAdapter('r2', r2GetUrl))
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel', vercelGetUrl))

    const { resolveStorageUrl } = await import('@/lib/storage')
    const url = await resolveStorageUrl('images/x.png')

    expect(url).toBe('https://r2.example.com/x.png')
    expect(vercelGetUrl).not.toHaveBeenCalled()
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('falls back to vercel and logs a warning when r2 is missing the object', async () => {
    mockEnv.STORAGE_PROVIDER = 'r2'
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token')
    const r2GetUrl = vi.fn().mockResolvedValue(null)
    const vercelGetUrl = vi
      .fn()
      .mockResolvedValue('https://vercel.example.com/x.png')
    mockCreateR2Adapter.mockReturnValue(makeAdapter('r2', r2GetUrl))
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel', vercelGetUrl))

    const { resolveStorageUrl } = await import('@/lib/storage')
    const url = await resolveStorageUrl('images/x.png')

    expect(url).toBe('https://vercel.example.com/x.png')
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'storage_dual_read_fallback',
        pathname: 'images/x.png',
        primaryProvider: 'r2',
        fallbackProvider: 'vercel',
      }),
      expect.any(String)
    )
    expect(mockLoggerError).not.toHaveBeenCalled()
  })

  it('falls back from vercel to r2 when vercel is the active provider', async () => {
    mockEnv.STORAGE_PROVIDER = 'vercel'
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token')
    mockEnv.R2_ACCOUNT_ID = 'acct'
    mockEnv.R2_ACCESS_KEY_ID = 'ak'
    mockEnv.R2_SECRET_ACCESS_KEY = 'sk'
    mockEnv.R2_BUCKET = 'bucket'
    mockEnv.R2_PUBLIC_BASE_URL = 'https://r2.example.com'
    const vercelGetUrl = vi.fn().mockResolvedValue(null)
    const r2GetUrl = vi.fn().mockResolvedValue('https://r2.example.com/x.png')
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel', vercelGetUrl))
    mockCreateR2Adapter.mockReturnValue(makeAdapter('r2', r2GetUrl))

    const { resolveStorageUrl } = await import('@/lib/storage')
    const url = await resolveStorageUrl('images/x.png')

    expect(url).toBe('https://r2.example.com/x.png')
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryProvider: 'vercel',
        fallbackProvider: 'r2',
      }),
      expect.any(String)
    )
  })

  it('returns null and logs an error when both providers miss', async () => {
    mockEnv.STORAGE_PROVIDER = 'r2'
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token')
    const r2GetUrl = vi.fn().mockResolvedValue(null)
    const vercelGetUrl = vi.fn().mockResolvedValue(null)
    mockCreateR2Adapter.mockReturnValue(makeAdapter('r2', r2GetUrl))
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel', vercelGetUrl))

    const { resolveStorageUrl } = await import('@/lib/storage')
    const url = await resolveStorageUrl('images/missing.png')

    expect(url).toBeNull()
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'storage_dual_read_miss',
        pathname: 'images/missing.png',
        primaryProvider: 'r2',
        fallbackProviders: ['vercel'],
      }),
      expect.any(String)
    )
  })

  it('does not probe an unconfigured fallback provider', async () => {
    mockEnv.STORAGE_PROVIDER = 's3'
    mockEnv.S3_REGION = 'us-east-1'
    mockEnv.S3_BUCKET = 'bucket'
    mockEnv.S3_ACCESS_KEY_ID = 'ak'
    mockEnv.S3_SECRET_ACCESS_KEY = 'sk'
    mockEnv.S3_PUBLIC_BASE_URL = 'https://s3.example.com'
    const s3GetUrl = vi.fn().mockResolvedValue(null)
    const vercelGetUrl = vi.fn()
    const r2GetUrl = vi.fn()
    mockCreateS3Adapter.mockReturnValue(makeAdapter('s3', s3GetUrl))
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel', vercelGetUrl))
    mockCreateR2Adapter.mockReturnValue(makeAdapter('r2', r2GetUrl))

    const { resolveStorageUrl } = await import('@/lib/storage')
    const url = await resolveStorageUrl('images/x.png')

    expect(url).toBeNull()
    expect(vercelGetUrl).not.toHaveBeenCalled()
    expect(r2GetUrl).not.toHaveBeenCalled()
  })

  it('uses configured per-provider fallback order', async () => {
    mockEnv.STORAGE_PROVIDER = 's3'
    mockEnv.STORAGE_FALLBACK_S3 = 'vercel,r2'
    mockEnv.S3_REGION = 'us-east-1'
    mockEnv.S3_BUCKET = 'bucket'
    mockEnv.S3_ACCESS_KEY_ID = 'ak'
    mockEnv.S3_SECRET_ACCESS_KEY = 'sk'
    mockEnv.S3_PUBLIC_BASE_URL = 'https://s3.example.com'
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token')
    mockEnv.R2_ACCOUNT_ID = 'acct'
    mockEnv.R2_ACCESS_KEY_ID = 'ak'
    mockEnv.R2_SECRET_ACCESS_KEY = 'sk'
    mockEnv.R2_BUCKET = 'bucket'
    mockEnv.R2_PUBLIC_BASE_URL = 'https://r2.example.com'

    const s3GetUrl = vi.fn().mockResolvedValue(null)
    const vercelGetUrl = vi.fn().mockResolvedValue(null)
    const r2GetUrl = vi.fn().mockResolvedValue('https://r2.example.com/x.png')
    mockCreateS3Adapter.mockReturnValue(makeAdapter('s3', s3GetUrl))
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel', vercelGetUrl))
    mockCreateR2Adapter.mockReturnValue(makeAdapter('r2', r2GetUrl))

    const { resolveStorageUrl } = await import('@/lib/storage')
    const url = await resolveStorageUrl('images/x.png')
    expect(url).toBe('https://r2.example.com/x.png')
    expect(vercelGetUrl).toHaveBeenCalledTimes(1)
    expect(r2GetUrl).toHaveBeenCalledTimes(1)
    expect(vercelGetUrl.mock.invocationCallOrder[0]).toBeLessThan(
      r2GetUrl.mock.invocationCallOrder[0]
    )
  })

  it('continues to fallbacks when primary provider read throws', async () => {
    mockEnv.STORAGE_PROVIDER = 's3'
    mockEnv.S3_REGION = 'us-east-1'
    mockEnv.S3_BUCKET = 'bucket'
    mockEnv.S3_ACCESS_KEY_ID = 'ak'
    mockEnv.S3_SECRET_ACCESS_KEY = 'sk'
    mockEnv.S3_PUBLIC_BASE_URL = 'https://s3.example.com'
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token')
    const s3GetUrl = vi.fn().mockRejectedValue(new Error('s3 unavailable'))
    const vercelGetUrl = vi
      .fn()
      .mockResolvedValue('https://vercel.example.com/x.png')
    mockCreateS3Adapter.mockReturnValue(makeAdapter('s3', s3GetUrl))
    mockCreateVercelAdapter.mockReturnValue(makeAdapter('vercel', vercelGetUrl))

    const { resolveStorageUrl } = await import('@/lib/storage')
    const url = await resolveStorageUrl('images/x.png')
    expect(url).toBe('https://vercel.example.com/x.png')
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'storage_primary_read_error',
        primaryProvider: 's3',
      }),
      expect.any(String)
    )
  })
})
