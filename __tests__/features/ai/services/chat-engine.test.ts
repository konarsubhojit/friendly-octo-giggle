import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getCachedAiResponseMock = vi.hoisted(() => vi.fn())
const getDailyUsageMock = vi.hoisted(() => vi.fn())
const enforceQuotasMock = vi.hoisted(() => vi.fn())
const recordDailyUsageMock = vi.hoisted(() => vi.fn())
const resolveCurrencyForUserMock = vi.hoisted(() => vi.fn())
const finalizeCachedAnswerMock = vi.hoisted(() => vi.fn())
const scheduleStreamSideEffectsMock = vi.hoisted(() => vi.fn())
const logBusinessEventMock = vi.hoisted(() => vi.fn())
const generateContentMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/ai/ai-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/ai-cache')>()
  return {
    ...actual,
    getCachedAiResponse: getCachedAiResponseMock,
  }
})

vi.mock('@/lib/ai/gateway', () => ({
  genAI: {
    models: {
      generateContent: generateContentMock,
    },
  },
  getAiConfigCached: vi.fn(() =>
    Promise.resolve({
      enabled: true,
      chatModel: 'gemini-2.0-flash',
      embeddingModel: 'text-embedding-004',
      maxResponseTokens: 512,
      maxContextChunks: 3,
      maxHistoryMessages: 10,
      advancedFeaturesEnabled: true,
      dailyRequestQuota: 40,
      dailyTokenQuota: 12000,
      advancedFeatureDailyRequestQuota: 15,
      maxToolCallsPerTurn: 1,
      thinkingLevel: 'none',
      includeThoughts: false,
    })
  ),
  buildGenerateConfig: vi.fn(
    (
      _config,
      systemInstruction: string,
      options?: {
        functionCallingMode?: string
        tools?: readonly {
          name: string
          description: string
          parametersJsonSchema?: unknown
        }[]
      }
    ) => ({
      systemInstruction,
      toolConfig: options?.functionCallingMode
        ? { functionCallingConfig: { mode: options.functionCallingMode } }
        : undefined,
      tools: options?.tools
        ? [{ functionDeclarations: [...options.tools] }]
        : undefined,
    })
  ),
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: logBusinessEventMock,
}))

vi.mock('@/features/ai/services/chat-request', () => ({
  parseAndValidateRequest: vi.fn(() =>
    Promise.resolve({
      ok: true,
      prepared: {
        identity: { userId: 'user-1', isAuthenticated: true },
        surface: 'catalog',
        persistHistory: false,
        threadId: 'catalog-user-scoped-default',
        sanitizedMessages: [{ role: 'user', text: 'Find a red bag' }],
      },
    })
  ),
  resolveCurrencyForUser: resolveCurrencyForUserMock,
}))

vi.mock('@/features/ai/services/chat-history', () => ({
  composeConversationMessages: vi.fn((messages) => Promise.resolve(messages)),
}))

vi.mock('@/features/ai/services/chat-usage', () => ({
  getDailyUsage: getDailyUsageMock,
  enforceQuotas: enforceQuotasMock,
  recordDailyUsage: recordDailyUsageMock,
}))

vi.mock('@/features/ai/services/chat-cached-answer', () => ({
  finalizeCachedAnswer: finalizeCachedAnswerMock,
}))

vi.mock('@/features/ai/services/chat-stream', () => ({
  buildStreamReader: vi.fn((stream: AsyncIterable<{ text?: string }>) => {
    const encoder = new TextEncoder()
    const fullTextPromise = (async () => {
      let text = ''
      for await (const chunk of stream) {
        text += chunk.text ?? ''
      }
      return text
    })()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const text = await fullTextPromise
        controller.enqueue(encoder.encode(text))
        controller.close()
      },
    })
    return { readable, fullTextPromise }
  }),
  scheduleStreamSideEffects: scheduleStreamSideEffectsMock,
}))

import { runChatEngine } from '@/features/ai/services/chat-engine'
import { buildAiCacheKey } from '@/lib/ai/ai-cache'

describe('chat-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCachedAiResponseMock.mockResolvedValue(null)
    getDailyUsageMock.mockResolvedValue({ requests: 0, tokens: 0 })
    enforceQuotasMock.mockResolvedValue(null)
    recordDailyUsageMock.mockResolvedValue(undefined)
    resolveCurrencyForUserMock.mockResolvedValue('INR')
  })

  it('stops issuing tool calls once the configured maximum is reached', async () => {
    generateContentMock
      .mockResolvedValueOnce({
        functionCalls: [
          { id: 'call-1', name: 'search_catalog', args: { query: 'red bag' } },
        ],
      })
      .mockResolvedValueOnce({
        functionCalls: [
          { id: 'call-2', name: 'search_catalog', args: { query: 'red bag' } },
        ],
        text: 'Here is the best answer from the first lookup.',
      })

    const response = await runChatEngine({
      request: new NextRequest('http://localhost/api/ai/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'Find a red bag' }],
        }),
      }),
      surface: 'catalog',
      systemPrompt: 'System prompt',
      toolRegistry: [
        {
          name: 'search_catalog',
          description: 'A test tool',
          argsSchema: (await import('zod')).z.object({
            query: (await import('zod')).z.string(),
          }),
          requiresAuth: false,
          execute: vi.fn().mockResolvedValue('Tool output'),
        },
      ],
    })

    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(await response.text()).toBe(
      'Here is the best answer from the first lookup.'
    )
    expect(generateContentMock).toHaveBeenCalledTimes(2)
    expect(generateContentMock.mock.calls[1][0].config.toolConfig).toEqual({
      functionCallingConfig: { mode: 'NONE' },
    })
    expect(logBusinessEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_chat_tool_call',
        details: expect.objectContaining({
          toolName: 'search_catalog',
          callCount: 1,
        }),
      })
    )
  })

  it('keeps cache keys disjoint across product and catalog surfaces', () => {
    expect(buildAiCacheKey('catalog', 'red bag', 'INR')).not.toBe(
      buildAiCacheKey('product:bag-1', 'red bag', 'INR')
    )
  })
})
