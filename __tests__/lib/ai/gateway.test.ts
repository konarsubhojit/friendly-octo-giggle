import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGenAI } = vi.hoisted(() => ({
  mockGenAI: {
    models: {
      generateContentStream: vi.fn(),
      generateContent: vi.fn(),
    },
  },
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return mockGenAI
  }),
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
  getAiConfig: vi.fn().mockResolvedValue({
    enabled: true,
    chatModel: 'gemini-2.0-flash',
    embeddingModel: 'text-embedding-004',
    maxResponseTokens: 512,
    maxContextChunks: 3,
    maxHistoryMessages: 10,
    thinkingLevel: 'none',
    includeThoughts: false,
  }),
}))

import { genAI, getAiConfigCached, buildGenerateConfig } from '@/lib/ai/gateway'
import { getAiConfig } from '@/lib/edge-config'

const baseAiConfig = {
  enabled: true,
  chatModel: 'gemini-2.0-flash',
  embeddingModel: 'text-embedding-004',
  maxResponseTokens: 512,
  maxContextChunks: 3,
  maxHistoryMessages: 10,
  thinkingLevel: 'none' as const,
  includeThoughts: false,
}

describe('lib/ai/gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('genAI', () => {
    it('is created with the API key', () => {
      expect(genAI).toBeDefined()
      expect(genAI.models).toBeDefined()
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
      vi.mocked(getAiConfig).mockClear()
      const config2 = await getAiConfigCached()

      expect(config1).toEqual(config2)
      expect(getAiConfig).toHaveBeenCalledTimes(0)
    })
  })

  describe('buildGenerateConfig', () => {
    it('builds config with system instruction and maxOutputTokens', () => {
      const config = buildGenerateConfig(
        baseAiConfig,
        'You are a helpful assistant.'
      )

      expect(config.systemInstruction).toBe('You are a helpful assistant.')
      expect(config.maxOutputTokens).toBe(512)
      expect(config.thinkingConfig).toBeUndefined()
    })

    it('omits thinkingConfig when thinkingLevel is none', () => {
      const config = buildGenerateConfig(
        { ...baseAiConfig, thinkingLevel: 'none' },
        'system'
      )
      expect(config.thinkingConfig).toBeUndefined()
    })

    it('omits thinkingConfig when thinkingLevel is absent', () => {
      const { thinkingLevel: _tl, ...configWithoutThinking } = baseAiConfig
      const config = buildGenerateConfig(configWithoutThinking, 'system')
      expect(config.thinkingConfig).toBeUndefined()
    })

    it('sets thinkingConfig with LOW level and includeThoughts', () => {
      const config = buildGenerateConfig(
        { ...baseAiConfig, thinkingLevel: 'low', includeThoughts: true },
        'system'
      )
      expect(config.thinkingConfig).toEqual({
        thinkingLevel: 'LOW',
        includeThoughts: true,
      })
    })

    it('sets thinkingConfig with MEDIUM level', () => {
      const config = buildGenerateConfig(
        { ...baseAiConfig, thinkingLevel: 'medium', includeThoughts: false },
        'system'
      )
      expect(config.thinkingConfig).toEqual({
        thinkingLevel: 'MEDIUM',
        includeThoughts: false,
      })
    })

    it('sets thinkingConfig with HIGH level', () => {
      const config = buildGenerateConfig(
        { ...baseAiConfig, thinkingLevel: 'high' },
        'system'
      )
      expect(config.thinkingConfig?.thinkingLevel).toBe('HIGH')
    })

    it('defaults includeThoughts to false when absent', () => {
      const { includeThoughts: _it, ...configWithoutInclude } = baseAiConfig
      const config = buildGenerateConfig(
        { ...configWithoutInclude, thinkingLevel: 'medium' },
        'system'
      )
      expect(config.thinkingConfig?.includeThoughts).toBe(false)
    })
  })
})
