import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockGetAll = vi.fn()

vi.mock('@vercel/edge-config', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  getAll: (...args: unknown[]) => mockGetAll(...args),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
  logCacheOperation: vi.fn(),
  Timer: class {
    end() {}
  },
}))

import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_SHIPPING_CONFIG,
  DEFAULT_AI_CONFIG,
  normalizeChatModel,
  SUPPORTED_CHAT_MODELS,
} from '@/lib/edge-config'

describe('edge-config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  describe('getFeatureFlags', () => {
    it('returns defaults when EDGE_CONFIG is not set', async () => {
      const { getFeatureFlags } = await import('@/lib/edge-config')
      const flags = await getFeatureFlags()
      expect(flags).toEqual(DEFAULT_FEATURE_FLAGS)
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('reads from edge config when available', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      const customFlags = {
        ...DEFAULT_FEATURE_FLAGS,
        saleMode: true,
        saleBannerText: '50% off!',
      }
      mockGet.mockResolvedValue(customFlags)
      const { getFeatureFlags } = await import('@/lib/edge-config')
      const flags = await getFeatureFlags()
      expect(flags.saleMode).toBe(true)
      expect(flags.saleBannerText).toBe('50% off!')
      expect(mockGet).toHaveBeenCalledWith('featureFlags')
    })

    it('returns defaults on edge config error', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockRejectedValue(new Error('Network error'))
      const { getFeatureFlags } = await import('@/lib/edge-config')
      const flags = await getFeatureFlags()
      expect(flags).toEqual(DEFAULT_FEATURE_FLAGS)
    })

    it('returns defaults when edge config returns null', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue(null)
      const { getFeatureFlags } = await import('@/lib/edge-config')
      const flags = await getFeatureFlags()
      expect(flags).toEqual(DEFAULT_FEATURE_FLAGS)
    })

    it('returns cached value on second call within TTL', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({ ...DEFAULT_FEATURE_FLAGS, saleMode: true })
      const { getFeatureFlags } = await import('@/lib/edge-config')
      await getFeatureFlags()
      await getFeatureFlags()
      expect(mockGet).toHaveBeenCalledTimes(1)
    })
  })

  describe('getShippingConfig', () => {
    it('returns defaults when EDGE_CONFIG is not set', async () => {
      const { getShippingConfig } = await import('@/lib/edge-config')
      const config = await getShippingConfig()
      expect(config).toEqual(DEFAULT_SHIPPING_CONFIG)
    })

    it('reads custom shipping config from edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      const custom = { ...DEFAULT_SHIPPING_CONFIG, freeShippingThreshold: 500 }
      mockGet.mockResolvedValue(custom)
      const { getShippingConfig } = await import('@/lib/edge-config')
      const config = await getShippingConfig()
      expect(config.freeShippingThreshold).toBe(500)
    })

    it('returns defaults when edge config returns null', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue(null)
      const { getShippingConfig } = await import('@/lib/edge-config')
      const config = await getShippingConfig()
      expect(config).toEqual(DEFAULT_SHIPPING_CONFIG)
    })

    it('returns defaults on error', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockRejectedValue(new Error('Network error'))
      const { getShippingConfig } = await import('@/lib/edge-config')
      const config = await getShippingConfig()
      expect(config).toEqual(DEFAULT_SHIPPING_CONFIG)
    })
  })

  describe('getAiConfig', () => {
    it('returns defaults when EDGE_CONFIG is not set', async () => {
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config).toEqual(DEFAULT_AI_CONFIG)
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('reads custom AI config from edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      const custom = { ...DEFAULT_AI_CONFIG, chatModel: 'gemini-2.5-flash' }
      mockGet.mockResolvedValue(custom)
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config.chatModel).toBe('gemini-2.5-flash')
      expect(mockGet).toHaveBeenCalledWith('aiConfig')
    })

    it('returns defaults when edge config returns null', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue(null)
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config).toEqual(DEFAULT_AI_CONFIG)
    })

    it('returns defaults on error', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockRejectedValue(new Error('Network error'))
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config).toEqual(DEFAULT_AI_CONFIG)
    })

    it('respects enabled flag from edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({ ...DEFAULT_AI_CONFIG, enabled: false })
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config.enabled).toBe(false)
    })

    it('normalizes provider-prefixed model to bare model name', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({
        ...DEFAULT_AI_CONFIG,
        chatModel: 'google/gemini-2.0-flash',
      })
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config.chatModel).toBe('gemini-2.0-flash')
    })

    it('falls back to default model when provider-prefixed model is unknown', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({
        ...DEFAULT_AI_CONFIG,
        chatModel: 'google/gemini-3.1-flash-lite-preview',
      })
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config.chatModel).toBe(DEFAULT_AI_CONFIG.chatModel)
    })

    it('falls back to default model when model name is unsupported', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({
        ...DEFAULT_AI_CONFIG,
        chatModel: 'completely-invalid-model',
      })
      const { getAiConfig } = await import('@/lib/edge-config')
      const config = await getAiConfig()
      expect(config.chatModel).toBe(DEFAULT_AI_CONFIG.chatModel)
    })
  })

  describe('isAiEnabled', () => {
    it('returns true by default', async () => {
      const { isAiEnabled } = await import('@/lib/edge-config')
      expect(await isAiEnabled()).toBe(true)
    })

    it('returns false when disabled via edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({ ...DEFAULT_AI_CONFIG, enabled: false })
      const { isAiEnabled } = await import('@/lib/edge-config')
      expect(await isAiEnabled()).toBe(false)
    })
  })

  describe('getAllEdgeConfig', () => {
    it('returns all defaults when EDGE_CONFIG is not set', async () => {
      const { getAllEdgeConfig } = await import('@/lib/edge-config')
      const data = await getAllEdgeConfig()
      expect(data.featureFlags).toEqual(DEFAULT_FEATURE_FLAGS)
      expect(data.shippingConfig).toEqual(DEFAULT_SHIPPING_CONFIG)
    })

    it('reads all config in a single call', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGetAll.mockResolvedValue({
        featureFlags: { ...DEFAULT_FEATURE_FLAGS, maintenanceMode: true },
        shippingConfig: DEFAULT_SHIPPING_CONFIG,
      })
      const { getAllEdgeConfig } = await import('@/lib/edge-config')
      const data = await getAllEdgeConfig()
      expect(data.featureFlags.maintenanceMode).toBe(true)
      expect(mockGetAll).toHaveBeenCalledWith([
        'featureFlags',
        'shippingConfig',
        'aiConfig',
      ])
    })

    it('returns defaults on error', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGetAll.mockRejectedValue(new Error('Network error'))
      const { getAllEdgeConfig } = await import('@/lib/edge-config')
      const data = await getAllEdgeConfig()
      expect(data.featureFlags).toEqual(DEFAULT_FEATURE_FLAGS)
    })
  })

  describe('helper functions', () => {
    it('isMaintenanceMode returns false by default', async () => {
      const { isMaintenanceMode } = await import('@/lib/edge-config')
      expect(await isMaintenanceMode()).toBe(false)
    })

    it('isSaleActive returns false by default', async () => {
      const { isSaleActive } = await import('@/lib/edge-config')
      expect(await isSaleActive()).toBe(false)
    })

    it('isMaintenanceMode reads from edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({
        ...DEFAULT_FEATURE_FLAGS,
        maintenanceMode: true,
      })
      const { isMaintenanceMode } = await import('@/lib/edge-config')
      expect(await isMaintenanceMode()).toBe(true)
    })
  })

  describe('normalizeChatModel', () => {
    it('passes through a valid supported model unchanged', () => {
      expect(normalizeChatModel('gemini-2.0-flash')).toBe('gemini-2.0-flash')
    })

    it('strips google/ prefix from a valid model', () => {
      expect(normalizeChatModel('google/gemini-2.0-flash')).toBe(
        'gemini-2.0-flash'
      )
    })

    it('falls back to default for unknown model after stripping prefix', () => {
      expect(normalizeChatModel('google/gemini-3.1-flash-lite-preview')).toBe(
        DEFAULT_AI_CONFIG.chatModel
      )
    })

    it('falls back to default for unsupported bare model name', () => {
      expect(normalizeChatModel('completely-invalid-model')).toBe(
        DEFAULT_AI_CONFIG.chatModel
      )
    })

    it('falls back to default for empty string', () => {
      expect(normalizeChatModel('')).toBe(DEFAULT_AI_CONFIG.chatModel)
    })

    it('falls back to default for a trailing-slash-only provider prefix', () => {
      expect(normalizeChatModel('google/')).toBe(DEFAULT_AI_CONFIG.chatModel)
    })

    it('SUPPORTED_CHAT_MODELS contains all expected models', () => {
      expect(SUPPORTED_CHAT_MODELS.has('gemini-2.0-flash')).toBe(true)
      expect(SUPPORTED_CHAT_MODELS.has('gemini-2.5-flash')).toBe(true)
      expect(SUPPORTED_CHAT_MODELS.has('gemini-2.5-pro')).toBe(true)
      expect(SUPPORTED_CHAT_MODELS.has('gemini-3.1-flash-lite-preview')).toBe(
        false
      )
    })
  })
})
