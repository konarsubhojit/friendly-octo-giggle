import { describe, it, expect, vi, afterEach } from 'vitest'

const mockConstructor = vi.hoisted(() =>
  vi.fn(function () {
    return {
      models: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn(),
      },
    }
  })
)

vi.mock('@google/genai', () => ({
  GoogleGenAI: mockConstructor,
  ThinkingLevel: {
    THINKING_LEVEL_UNSPECIFIED: 'THINKING_LEVEL_UNSPECIFIED',
    MINIMAL: 'MINIMAL',
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
  },
}))

vi.mock('@/lib/env', () => ({
  env: { GOOGLE_GENERATIVE_AI_API_KEY: 'test-api-key' },
}))

vi.mock('@/lib/edge-config', () => ({
  getAiConfig: vi.fn(),
}))

describe('lib/ai/gateway — lazy initialization', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('does not call GoogleGenAI constructor at module import time', async () => {
    const { genAI: freshGenAI } = await import('@/lib/ai/gateway')

    // Just importing should not trigger the constructor
    expect(mockConstructor).not.toHaveBeenCalled()

    // Accessing a property on the proxy triggers lazy init
    const _models = freshGenAI.models
    expect(mockConstructor).toHaveBeenCalledTimes(1)
  })

  it('reuses the same instance across multiple property accesses', async () => {
    const { genAI: freshGenAI } = await import('@/lib/ai/gateway')

    const _first = freshGenAI.models
    const _second = freshGenAI.models
    const _third = freshGenAI.models

    // Constructor called only once regardless of access count
    expect(mockConstructor).toHaveBeenCalledTimes(1)
  })

  it('binds methods to the underlying instance so this is correct', async () => {
    let capturedThis: unknown
    const fakeInstance = {
      doSomething: function (this: unknown) {
        capturedThis = this
      },
    }
    mockConstructor.mockImplementationOnce(function () {
      return fakeInstance
    })

    const { genAI: freshGenAI } = await import('@/lib/ai/gateway')

    // Access the method through the proxy and call it
    const method = (freshGenAI as unknown as typeof fakeInstance).doSomething
    method()

    // The method is bound to fakeInstance, not the Proxy
    expect(capturedThis).toBe(fakeInstance)
  })
})
