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
})
