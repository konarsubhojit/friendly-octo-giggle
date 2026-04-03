import { describe, it, expect, vi, afterEach } from 'vitest'

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
  getFeatureFlags,
  getShippingConfig,
  getAiConfig,
  getAllEdgeConfig,
  isMaintenanceMode,
  isSaleActive,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_SHIPPING_CONFIG,
  DEFAULT_AI_CONFIG,
} from '@/lib/edge-config'

describe('edge-config', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  describe('getFeatureFlags', () => {
    it('returns defaults when EDGE_CONFIG is not set', async () => {
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
      const flags = await getFeatureFlags()
      expect(flags.saleMode).toBe(true)
      expect(flags.saleBannerText).toBe('50% off!')
      expect(mockGet).toHaveBeenCalledWith('featureFlags')
    })

    it('returns defaults on edge config error', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockRejectedValue(new Error('Network error'))
      const flags = await getFeatureFlags()
      expect(flags).toEqual(DEFAULT_FEATURE_FLAGS)
    })

    it('returns defaults when edge config returns null', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue(null)
      const flags = await getFeatureFlags()
      expect(flags).toEqual(DEFAULT_FEATURE_FLAGS)
    })
  })

  describe('getShippingConfig', () => {
    it('returns defaults when EDGE_CONFIG is not set', async () => {
      const config = await getShippingConfig()
      expect(config).toEqual(DEFAULT_SHIPPING_CONFIG)
    })

    it('reads custom shipping config from edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      const custom = { ...DEFAULT_SHIPPING_CONFIG, freeShippingThreshold: 500 }
      mockGet.mockResolvedValue(custom)
      const config = await getShippingConfig()
      expect(config.freeShippingThreshold).toBe(500)
    })

    it('returns defaults when edge config returns null', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue(null)
      const config = await getShippingConfig()
      expect(config).toEqual(DEFAULT_SHIPPING_CONFIG)
    })

    it('returns defaults on error', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockRejectedValue(new Error('Network error'))
      const config = await getShippingConfig()
      expect(config).toEqual(DEFAULT_SHIPPING_CONFIG)
    })
  })

  describe('getAiConfig', () => {
    it('returns defaults when EDGE_CONFIG is not set', async () => {
      const config = await getAiConfig()
      expect(config).toEqual(DEFAULT_AI_CONFIG)
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('reads custom AI config from edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      const custom = { ...DEFAULT_AI_CONFIG, chatModel: 'gpt-5-turbo' }
      mockGet.mockResolvedValue(custom)
      const config = await getAiConfig()
      expect(config.chatModel).toBe('gpt-5-turbo')
      expect(mockGet).toHaveBeenCalledWith('aiConfig')
    })

    it('returns defaults when edge config returns null', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue(null)
      const config = await getAiConfig()
      expect(config).toEqual(DEFAULT_AI_CONFIG)
    })

    it('returns defaults on error', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockRejectedValue(new Error('Network error'))
      const config = await getAiConfig()
      expect(config).toEqual(DEFAULT_AI_CONFIG)
    })
  })

  describe('getAllEdgeConfig', () => {
    it('returns all defaults when EDGE_CONFIG is not set', async () => {
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
      const data = await getAllEdgeConfig()
      expect(data.featureFlags).toEqual(DEFAULT_FEATURE_FLAGS)
    })
  })

  describe('helper functions', () => {
    it('isMaintenanceMode returns false by default', async () => {
      expect(await isMaintenanceMode()).toBe(false)
    })

    it('isSaleActive returns false by default', async () => {
      expect(await isSaleActive()).toBe(false)
    })

    it('isMaintenanceMode reads from edge config', async () => {
      vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_test')
      mockGet.mockResolvedValue({
        ...DEFAULT_FEATURE_FLAGS,
        maintenanceMode: true,
      })
      expect(await isMaintenanceMode()).toBe(true)
    })
  })
})
