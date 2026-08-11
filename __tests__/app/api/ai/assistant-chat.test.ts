import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getCachedAiResponseMock = vi.hoisted(() => vi.fn())
const generateContentMock = vi.hoisted(() => vi.fn())
const getDailyUsageMock = vi.hoisted(() => vi.fn())
const enforceQuotasMock = vi.hoisted(() => vi.fn())
const recordDailyUsageMock = vi.hoisted(() => vi.fn())
const finalizeCachedAnswerMock = vi.hoisted(() => vi.fn())
const scheduleStreamSideEffectsMock = vi.hoisted(() => vi.fn())

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
      maxToolCallsPerTurn: 3,
      thinkingLevel: 'none',
      includeThoughts: false,
    })
  ),
  buildGenerateConfig: vi.fn(
    (_config, systemInstruction: string, options?: { functionCallingMode?: string }) => ({
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

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      users: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      products: {
        findMany: vi.fn(() => Promise.resolve([])),
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    },
  },
  db: {
    products: {
      findMinimalByIds: vi.fn(() => Promise.resolve([])),
      findById: vi.fn(() => Promise.resolve(null)),
    },
  },
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

import { POST } from '@/app/api/ai/assistant/chat/route'

describe('POST /api/ai/assistant/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCachedAiResponseMock.mockResolvedValue(null)
    generateContentMock.mockResolvedValue({ text: 'Try [Travel Bag](/products/prod-1).' })
    getDailyUsageMock.mockResolvedValue({ requests: 0, tokens: 0 })
    enforceQuotasMock.mockResolvedValue(null)
    recordDailyUsageMock.mockResolvedValue(undefined)
    finalizeCachedAnswerMock.mockResolvedValue(undefined)
  })

  it('returns 400 when messages are missing', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ai/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
      })
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 when a message exceeds the max length', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ai/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'a'.repeat(501) }],
        }),
      })
    )

    expect(response.status).toBe(400)
  })

  it('streams a plain-text response on cache miss', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ai/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'Find me a travel bag' }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(await response.text()).toBe('Try [Travel Bag](/products/prod-1).')
  })

  it('returns cached JSON on cache hit', async () => {
    getCachedAiResponseMock.mockResolvedValue('Cached answer')

    const response = await POST(
      new NextRequest('http://localhost/api/ai/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'Find me a travel bag' }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: 'Cached answer', threadId: undefined })
    expect(generateContentMock).not.toHaveBeenCalled()
  })
})
