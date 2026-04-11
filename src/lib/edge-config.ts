import { get, getAll } from '@vercel/edge-config'
import { logError, logBusinessEvent } from '@/lib/logger'

export interface FeatureFlags {
  readonly maintenanceMode: boolean
  readonly saleMode: boolean
  readonly saleBannerText: string
  readonly enableWishlist: boolean
  readonly enableReviews: boolean
}

export interface ShippingConfig {
  readonly freeShippingThreshold: number
  readonly standardShippingRate: number
  readonly expressShippingRate: number
  readonly estimatedDeliveryDays: number
}

export interface AiConfig {
  readonly enabled: boolean
  readonly chatModel: string
  readonly embeddingModel: string
  readonly maxResponseTokens: number
  readonly maxContextChunks: number
  readonly maxHistoryMessages: number
  readonly thinkingLevel?: 'none' | 'low' | 'medium' | 'high'
  readonly includeThoughts?: boolean
}

export interface EdgeConfigData {
  readonly featureFlags: FeatureFlags
  readonly shippingConfig: ShippingConfig
  readonly aiConfig: AiConfig
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  maintenanceMode: false,
  saleMode: false,
  saleBannerText: '',
  enableWishlist: true,
  enableReviews: true,
}

const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  freeShippingThreshold: 999,
  standardShippingRate: 49,
  expressShippingRate: 149,
  estimatedDeliveryDays: 5,
}

const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: true,
  chatModel: 'gemini-2.0-flash',
  embeddingModel: 'text-embedding-004',
  maxResponseTokens: 512,
  maxContextChunks: 3,
  maxHistoryMessages: 10,
  thinkingLevel: 'none',
  includeThoughts: false,
}

// Supported Google Gemini model names accepted by the GenAI SDK.
// Update this list when Google releases new models or deprecates existing ones.
export const SUPPORTED_CHAT_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
])

export const normalizeChatModel = (model: string): string => {
  if (!model?.trim()) return DEFAULT_AI_CONFIG.chatModel
  // Strip provider prefix (e.g. "google/gemini-2.0-flash" → "gemini-2.0-flash")
  const normalized = model.includes('/') ? (model.split('/').pop() ?? '') : model
  return SUPPORTED_CHAT_MODELS.has(normalized)
    ? normalized
    : DEFAULT_AI_CONFIG.chatModel
}

const isEdgeConfigAvailable = (): boolean => !!process.env.EDGE_CONFIG

const EDGE_CONFIG_TTL_MS = 60_000

let cachedFlags: { value: FeatureFlags; expiresAt: number } | null = null
let cachedShipping: { value: ShippingConfig; expiresAt: number } | null = null
let cachedAiConfig: { value: AiConfig; expiresAt: number } | null = null
let cachedAllConfig: { value: EdgeConfigData; expiresAt: number } | null = null

export const getFeatureFlags = async (): Promise<FeatureFlags> => {
  const now = Date.now()
  if (cachedFlags && cachedFlags.expiresAt > now) return cachedFlags.value

  if (!isEdgeConfigAvailable()) return DEFAULT_FEATURE_FLAGS

  try {
    const flags = await get<FeatureFlags>('featureFlags')
    const result = flags ?? DEFAULT_FEATURE_FLAGS
    cachedFlags = { value: result, expiresAt: now + EDGE_CONFIG_TTL_MS }
    return result
  } catch (error) {
    logError({ error, context: 'edge_config_feature_flags' })
    return DEFAULT_FEATURE_FLAGS
  }
}

export const getShippingConfig = async (): Promise<ShippingConfig> => {
  const now = Date.now()
  if (cachedShipping && cachedShipping.expiresAt > now)
    return cachedShipping.value

  if (!isEdgeConfigAvailable()) return DEFAULT_SHIPPING_CONFIG

  try {
    const config = await get<ShippingConfig>('shippingConfig')
    const result = config ?? DEFAULT_SHIPPING_CONFIG
    cachedShipping = { value: result, expiresAt: now + EDGE_CONFIG_TTL_MS }
    return result
  } catch (error) {
    logError({ error, context: 'edge_config_shipping' })
    return DEFAULT_SHIPPING_CONFIG
  }
}

export const getAiConfig = async (): Promise<AiConfig> => {
  const now = Date.now()
  if (cachedAiConfig && cachedAiConfig.expiresAt > now)
    return cachedAiConfig.value

  if (!isEdgeConfigAvailable()) return DEFAULT_AI_CONFIG

  try {
    const config = await get<AiConfig>('aiConfig')
    const base = config ?? DEFAULT_AI_CONFIG
    const result = { ...base, chatModel: normalizeChatModel(base.chatModel) }
    cachedAiConfig = { value: result, expiresAt: now + EDGE_CONFIG_TTL_MS }
    return result
  } catch (error) {
    logError({ error, context: 'edge_config_ai' })
    return DEFAULT_AI_CONFIG
  }
}

export const getAllEdgeConfig = async (): Promise<EdgeConfigData> => {
  const now = Date.now()
  if (cachedAllConfig && cachedAllConfig.expiresAt > now)
    return cachedAllConfig.value

  if (!isEdgeConfigAvailable()) {
    return {
      featureFlags: DEFAULT_FEATURE_FLAGS,
      shippingConfig: DEFAULT_SHIPPING_CONFIG,
      aiConfig: DEFAULT_AI_CONFIG,
    }
  }

  try {
    const data = await getAll<{
      featureFlags: FeatureFlags
      shippingConfig: ShippingConfig
      aiConfig: AiConfig
    }>(['featureFlags', 'shippingConfig', 'aiConfig'])

    logBusinessEvent({
      event: 'edge_config_read',
      details: { keys: Object.keys(data) },
      success: true,
    })

    const baseAiConfig = data.aiConfig ?? DEFAULT_AI_CONFIG
    const result = {
      featureFlags: data.featureFlags ?? DEFAULT_FEATURE_FLAGS,
      shippingConfig: data.shippingConfig ?? DEFAULT_SHIPPING_CONFIG,
      aiConfig: {
        ...baseAiConfig,
        chatModel: normalizeChatModel(baseAiConfig.chatModel),
      },
    }
    cachedAllConfig = { value: result, expiresAt: now + EDGE_CONFIG_TTL_MS }
    return result
  } catch (error) {
    logError({ error, context: 'edge_config_get_all' })
    return {
      featureFlags: DEFAULT_FEATURE_FLAGS,
      shippingConfig: DEFAULT_SHIPPING_CONFIG,
      aiConfig: DEFAULT_AI_CONFIG,
    }
  }
}

export const isMaintenanceMode = async (): Promise<boolean> => {
  const flags = await getFeatureFlags()
  return flags.maintenanceMode
}

export const isSaleActive = async (): Promise<boolean> => {
  const flags = await getFeatureFlags()
  return flags.saleMode
}

export const isAiEnabled = async (): Promise<boolean> => {
  const config = await getAiConfig()
  return config.enabled ?? true
}

export { DEFAULT_FEATURE_FLAGS, DEFAULT_SHIPPING_CONFIG, DEFAULT_AI_CONFIG }
