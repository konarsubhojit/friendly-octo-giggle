import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateVercelAdapter = vi.hoisted(() => vi.fn())
const mockCreateR2Adapter = vi.hoisted(() => vi.fn())
const mockLoggerWarn = vi.hoisted(() => vi.fn())
const mockLoggerError = vi.hoisted(() => vi.fn())

const mockEnv = vi.hoisted(() => ({
  STORAGE_PROVIDER: undefined as string | undefined,
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

const makeAdapter = (provider: 'vercel' | 'r2', getUrl = vi.fn()) => ({
  provider,
  put: vi.fn(),
  delete: vi.fn(),
  getUrl,
  list: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.STORAGE_PROVIDER = undefined
  vi.resetModules()
})

describe('getActiveProvider', () => {
  it('defaults to vercel when STORAGE_PROVIDER is unset', async () => {
    const { getActiveProvider } = await import('@/lib/storage')
    expect(getActiveProvider()).toBe('vercel')
  })

  it('is r2 when STORAGE_PROVIDER=r2', async () => {
    mockEnv.STORAGE_PROVIDER = 'r2'
    const { getActiveProvider } = await import('@/lib/storage')
    expect(getActiveProvider()).toBe('r2')
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
        fallbackProvider: 'vercel',
      }),
      expect.any(String)
    )
  })
})
