import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockProvider } = vi.hoisted(() => {
  const mockFn = vi.fn((modelId: string) => ({ modelId })) as ReturnType<
    typeof vi.fn
  > & { languageModel: ReturnType<typeof vi.fn> }
  mockFn.languageModel = vi.fn((modelId: string) => ({ modelId }))
  return { mockProvider: mockFn }
})

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => mockProvider),
}))

vi.mock('@/lib/env', () => ({
  env: { GOOGLE_GENERATIVE_AI_API_KEY: 'test-api-key' },
}))

vi.mock('@/lib/edge-config', () => ({
  getAiConfig: vi.fn().mockResolvedValue({
    chatModel: 'gemini-2.0-flash',
    embeddingModel: 'text-embedding-004',
    maxResponseTokens: 512,
    maxContextChunks: 3,
    maxHistoryMessages: 10,
  }),
}))

import {
  googleProvider,
  getAiConfigCached,
  getChatModel,
  getProviderOptions,
} from '@/lib/ai/gateway'
import { getAiConfig } from '@/lib/edge-config'

const baseAiConfig = {
  chatModel: 'gemini-2.0-flash',
  embeddingModel: 'text-embedding-004',
  maxResponseTokens: 512,
  maxContextChunks: 3,
  maxHistoryMessages: 10,
  providerNamespace: 'google' as string,
  thinkingLevel: 'none' as const,
  includeThoughts: false,
}

describe('lib/ai/gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('googleProvider', () => {
    it('is created with the API key', () => {
      expect(googleProvider).toBeDefined()
    })
  })

  describe('getAiConfigCached', () => {
    it('fetches config on first call', async () => {
      const config = await getAiConfigCached()

      expect(config.chatModel).toBe('gemini-2.0-flash')
      expect(getAiConfig).toHaveBeenCalledTimes(1)
    })

    it('returns cached config on subsequent calls within TTL', async () => {
      const config1 = await getAiConfigCached()
      const config2 = await getAiConfigCached()

      expect(config1).toEqual(config2)
    })
  })

  describe('getChatModel', () => {
    it('returns a language model for the given ID', () => {
      const model = getChatModel('gemini-2.0-flash')

      expect(model).toBeDefined()
      expect(model).toEqual({ modelId: 'gemini-2.0-flash' })
    })

    it('strips provider prefix from model ID', () => {
      const model = getChatModel('google/gemini-2.0-flash')

      expect(model).toBeDefined()
      expect(model).toEqual({ modelId: 'gemini-2.0-flash' })
    })
  })

  describe('getProviderOptions', () => {
    it('returns undefined when thinkingLevel is none', () => {
      expect(
        getProviderOptions({ ...baseAiConfig, thinkingLevel: 'none' })
      ).toBeUndefined()
    })

    it('returns undefined when thinkingLevel is absent', () => {
      const { thinkingLevel: _tl, ...configWithoutThinking } = baseAiConfig
      expect(getProviderOptions(configWithoutThinking)).toBeUndefined()
    })

    it('returns google namespace options when providerNamespace is google', () => {
      const result = getProviderOptions({
        ...baseAiConfig,
        providerNamespace: 'google',
        thinkingLevel: 'medium',
        includeThoughts: true,
      })
      expect(result).toEqual({
        google: {
          thinkingConfig: {
            thinkingLevel: 'medium',
            includeThoughts: true,
          },
        },
      })
    })

    it('returns vertex namespace options when providerNamespace is vertex', () => {
      const result = getProviderOptions({
        ...baseAiConfig,
        providerNamespace: 'vertex',
        thinkingLevel: 'high',
        includeThoughts: false,
      })
      expect(result).toEqual({
        vertex: {
          thinkingConfig: {
            thinkingLevel: 'high',
            includeThoughts: false,
          },
        },
      })
    })

    it('returns anthropic namespace options when providerNamespace is anthropic', () => {
      const result = getProviderOptions({
        ...baseAiConfig,
        providerNamespace: 'anthropic',
        thinkingLevel: 'low',
        includeThoughts: true,
      })
      expect(result).toEqual({
        anthropic: {
          thinkingConfig: {
            thinkingLevel: 'low',
            includeThoughts: true,
          },
        },
      })
    })

    it('derives namespace from chatModel prefix when providerNamespace is absent', () => {
      const { providerNamespace: _ns, ...configWithoutNamespace } = baseAiConfig
      const result = getProviderOptions({
        ...configWithoutNamespace,
        chatModel: 'google/gemini-3.1-flash-lite-preview',
        thinkingLevel: 'medium',
      })
      expect(result).toEqual({
        google: {
          thinkingConfig: {
            thinkingLevel: 'medium',
            includeThoughts: false,
          },
        },
      })
    })

    it('returns undefined when model ID has no slash and providerNamespace is absent', () => {
      const { providerNamespace: _ns, ...configWithoutNamespace } = baseAiConfig
      expect(
        getProviderOptions({
          ...configWithoutNamespace,
          chatModel: 'gemini-2.0-flash',
          thinkingLevel: 'medium',
        })
      ).toBeUndefined()
    })

    it('defaults includeThoughts to false when absent', () => {
      const { includeThoughts: _it, ...configWithoutInclude } = baseAiConfig
      const result = getProviderOptions({
        ...configWithoutInclude,
        thinkingLevel: 'medium',
      })
      expect(result?.google).toEqual({
        thinkingConfig: { thinkingLevel: 'medium', includeThoughts: false },
      })
    })
  })
})
