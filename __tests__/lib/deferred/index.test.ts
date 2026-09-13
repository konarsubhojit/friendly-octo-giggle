import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetProvider, mockCreateProcessRunner, mockCreateVercelRunner } =
  vi.hoisted(() => ({
    mockGetProvider: vi.fn(),
    mockCreateProcessRunner: vi.fn(() => ({
      provider: 'process' as const,
      waitUntil: vi.fn(),
    })),
    mockCreateVercelRunner: vi.fn(() => ({
      provider: 'vercel' as const,
      waitUntil: vi.fn(),
    })),
  }))

vi.mock('@/lib/providers/resolution', () => ({
  getProvider: mockGetProvider,
}))

vi.mock('@/lib/deferred/process', () => ({
  createProcessDeferredRunner: mockCreateProcessRunner,
}))

vi.mock('@/lib/deferred/vercel', () => ({
  createVercelDeferredRunner: mockCreateVercelRunner,
}))

describe('getDeferredRunner', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { __resetDeferredRunnerForTests } = await import('@/lib/deferred')
    __resetDeferredRunnerForTests()
  })

  it('resolves the process runner when the provider is process', async () => {
    mockGetProvider.mockReturnValue('process')
    const { getDeferredRunner } = await import('@/lib/deferred')

    const runner = getDeferredRunner()

    expect(runner.provider).toBe('process')
    expect(mockCreateProcessRunner).toHaveBeenCalledTimes(1)
    expect(mockCreateVercelRunner).not.toHaveBeenCalled()
  })

  it('resolves the vercel runner when the provider is vercel', async () => {
    mockGetProvider.mockReturnValue('vercel')
    const { getDeferredRunner } = await import('@/lib/deferred')

    const runner = getDeferredRunner()

    expect(runner.provider).toBe('vercel')
    expect(mockCreateVercelRunner).toHaveBeenCalledTimes(1)
  })

  it('memoizes the runner across calls', async () => {
    mockGetProvider.mockReturnValue('process')
    const { getDeferredRunner } = await import('@/lib/deferred')

    getDeferredRunner()
    getDeferredRunner()

    expect(mockCreateProcessRunner).toHaveBeenCalledTimes(1)
  })

  it('__resetDeferredRunnerForTests forces a fresh resolution', async () => {
    mockGetProvider.mockReturnValue('process')
    const { getDeferredRunner, __resetDeferredRunnerForTests } = await import(
      '@/lib/deferred'
    )

    getDeferredRunner()
    __resetDeferredRunnerForTests()
    getDeferredRunner()

    expect(mockCreateProcessRunner).toHaveBeenCalledTimes(2)
  })

  it('waitUntil convenience export delegates to the resolved runner', async () => {
    mockGetProvider.mockReturnValue('process')
    const { waitUntil } = await import('@/lib/deferred')
    const promise = Promise.resolve()

    waitUntil(promise)

    expect(mockCreateProcessRunner).toHaveBeenCalledTimes(1)
    const runnerInstance = mockCreateProcessRunner.mock.results[0].value
    expect(runnerInstance.waitUntil).toHaveBeenCalledWith(promise)
  })
})
