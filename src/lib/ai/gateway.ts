import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { JSONValue } from '@ai-sdk/provider'
import { env } from '@/lib/env'
import { getAiConfig, type AiConfig } from '@/lib/edge-config'

export const googleProvider = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
})

let cachedConfig: { value: AiConfig; expiresAt: number } | null = null
const CONFIG_TTL_MS = 60_000

export const getAiConfigCached = async (): Promise<AiConfig> => {
  const now = Date.now()
  if (cachedConfig && cachedConfig.expiresAt > now) return cachedConfig.value
  const config = await getAiConfig()
  cachedConfig = { value: config, expiresAt: now + CONFIG_TTL_MS }
  return config
}

const stripProviderPrefix = (modelId: string): string => {
  const separatorIndex = modelId.indexOf('/')
  return separatorIndex > 0 ? modelId.slice(separatorIndex + 1) : modelId
}

export const getChatModel = (modelId: string) =>
  googleProvider(stripProviderPrefix(modelId))

const getProviderNamespace = (aiConfig: AiConfig): string | undefined => {
  const explicitNamespace = aiConfig.providerNamespace?.trim()
  if (explicitNamespace) return explicitNamespace

  const separatorIndex = aiConfig.chatModel.indexOf('/')
  if (separatorIndex <= 0) return undefined

  return aiConfig.chatModel.slice(0, separatorIndex).trim() || undefined
}

export const getProviderOptions = (
  aiConfig: AiConfig
): Record<string, Record<string, JSONValue>> | undefined => {
  if (!aiConfig.thinkingLevel || aiConfig.thinkingLevel === 'none')
    return undefined

  const namespace = getProviderNamespace(aiConfig)
  if (!namespace) return undefined

  return {
    [namespace]: {
      thinkingConfig: {
        thinkingLevel: aiConfig.thinkingLevel,
        includeThoughts: aiConfig.includeThoughts ?? false,
      },
    },
  }
}
