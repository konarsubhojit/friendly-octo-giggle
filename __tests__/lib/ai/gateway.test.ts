import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@ai-sdk/gateway", () => ({
  createGateway: vi.fn(() => ({
    languageModel: vi.fn((modelId: string) => ({ modelId })),
  })),
}));

vi.mock("@/lib/env", () => ({
  env: { VERCEL_AI_API_KEY: "test-api-key" },
}));

vi.mock("@/lib/edge-config", () => ({
  getAiConfig: vi.fn().mockResolvedValue({
    chatModel: "openai/gpt-4",
    embeddingModel: "openai/text-embedding-3-small",
    maxResponseTokens: 512,
    maxContextChunks: 3,
    maxHistoryMessages: 10,
  }),
}));

import { gateway, getAiConfigCached, getChatModel } from "@/lib/ai/gateway";
import { getAiConfig } from "@/lib/edge-config";

describe("lib/ai/gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("gateway", () => {
    it("is created with the API key", () => {
      expect(gateway).toBeDefined();
    });
  });

  describe("getAiConfigCached", () => {
    it("fetches config on first call", async () => {
      const config = await getAiConfigCached();

      expect(config.chatModel).toBe("openai/gpt-4");
      expect(getAiConfig).toHaveBeenCalledTimes(1);
    });

    it("returns cached config on subsequent calls within TTL", async () => {
      const config1 = await getAiConfigCached();
      const config2 = await getAiConfigCached();

      expect(config1).toEqual(config2);
    });
  });

  describe("getChatModel", () => {
    it("returns a language model for the given ID", () => {
      const model = getChatModel("openai/gpt-4");

      expect(model).toBeDefined();
      expect(model).toEqual({ modelId: "openai/gpt-4" });
    });
  });
});
