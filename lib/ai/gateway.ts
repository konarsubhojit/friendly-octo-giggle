import { createGateway } from "@ai-sdk/gateway";
import { env } from "@/lib/env";
import { getAiConfig, type AiConfig } from "@/lib/edge-config";

export const gateway = createGateway({
  apiKey: env.VERCEL_AI_API_KEY,
});

let cachedConfig: { value: AiConfig; expiresAt: number } | null = null;
const CONFIG_TTL_MS = 60_000;

export const getAiConfigCached = async (): Promise<AiConfig> => {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) return cachedConfig.value;
  const config = await getAiConfig();
  cachedConfig = { value: config, expiresAt: now + CONFIG_TTL_MS };
  return config;
};

export const getChatModel = (modelId: string) => gateway.languageModel(modelId);
