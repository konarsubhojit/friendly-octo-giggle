import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { GenerateContentConfig } from '@google/genai'
import { env } from '@/lib/env'
import { getAiConfig, type AiConfig } from '@/lib/edge-config'

export const genAI = new GoogleGenAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
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

const THINKING_LEVEL_MAP: Record<'low' | 'medium' | 'high', ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
}

export const buildGenerateConfig = (
  aiConfig: AiConfig,
  systemInstruction: string
): GenerateContentConfig => {
  const config: GenerateContentConfig = {
    systemInstruction,
    maxOutputTokens: aiConfig.maxResponseTokens,
  }

  if (aiConfig.thinkingLevel && aiConfig.thinkingLevel !== 'none') {
    config.thinkingConfig = {
      thinkingLevel: THINKING_LEVEL_MAP[aiConfig.thinkingLevel],
      includeThoughts: aiConfig.includeThoughts ?? false,
    }
  }

  return config
}
