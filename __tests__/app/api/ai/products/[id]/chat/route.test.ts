import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const buildProductContextMock = vi.hoisted(() =>
  vi.fn(
    (
      _product,
      options?: {
        currencyCode?: string
        formatPrice?: (price: number) => string
      }
    ) => {
      const formatted = options?.formatPrice
        ? options.formatPrice(29.99)
        : 'no-format'
      const code = options?.currencyCode ?? 'none'
      return `context-price-${code}-${formatted}`
    }
  )
)

const getCachedAiResponseMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(null)
)
const setCachedAiResponseMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
const waitUntilMock = vi.hoisted(() => vi.fn())

const mockStreamChunks = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findById: vi.fn(),
    },
  },
  drizzleDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}))

vi.mock('@/lib/ai/gateway', () => ({
  genAI: {
    models: {
      generateContentStream: mockStreamChunks,
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
      thinkingLevel: 'none',
      includeThoughts: false,
    })
  ),
  buildGenerateConfig: vi.fn(() => ({
    systemInstruction: 'mock system',
    maxOutputTokens: 512,
  })),
}))

vi.mock('@/lib/ai/product-rag', () => ({
  buildProductContext: buildProductContextMock,
}))

vi.mock('@/lib/ai/ai-cache', () => ({
  getCachedAiResponse: getCachedAiResponseMock,
  setCachedAiResponse: setCachedAiResponseMock,
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: waitUntilMock,
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
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  ),
}))

vi.mock('@/lib/currency', () => ({
  formatPriceForCurrency: vi.fn(
    (price: number, currencyCode: string) => `${currencyCode}-${price}`
  ),
  isValidCurrencyCode: (code: string) =>
    ['INR', 'USD', 'EUR', 'GBP'].includes(code),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { db, drizzleDb } from '@/lib/db'
import { logError, logBusinessEvent } from '@/lib/logger'
import { auth } from '@/lib/auth'
import { getAiConfigCached } from '@/lib/ai/gateway'
import { POST } from '@/app/api/ai/products/[id]/chat/route'

const mockProduct = {
  id: 'abc1234',
  name: 'Test Product',
  description: 'A test product',
  price: 29.99,
  stock: 100,
  image: 'https://example.com/image.jpg',
  images: [],
  category: 'Electronics',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  variants: [],
}

const validBody = {
  messages: [{ role: 'user', text: 'Is this product in stock?' }],
}

const makeAsyncGenerator = async function* (chunks: string[]) {
  for (const text of chunks) {
    yield { text }
  }
}

describe('POST /api/ai/products/[id]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(null as never)
    vi.mocked(drizzleDb.query.users.findFirst).mockResolvedValue(null as never)
    getCachedAiResponseMock.mockResolvedValue(null)
    setCachedAiResponseMock.mockResolvedValue(undefined)
    buildProductContextMock.mockClear()
    mockStreamChunks.mockReturnValue(makeAsyncGenerator(['Hello', ' world']))
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue(null as never)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Authentication required')
  })

  it('returns 404 when product not found', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(null)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)

    const request = new NextRequest(
      'http://localhost/api/ai/products/notfound/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'notfound' }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Product not found')
  })

  it('returns 400 for invalid request body', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify({ messages: 'not-an-array' }) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 503 when AI is disabled', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)
    vi.mocked(getAiConfigCached).mockResolvedValueOnce({
      enabled: false,
      chatModel: 'gemini-2.0-flash',
      embeddingModel: 'text-embedding-004',
      maxResponseTokens: 512,
      maxContextChunks: 3,
      maxHistoryMessages: 10,
      thinkingLevel: 'none',
      includeThoughts: false,
    })

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(503)
    const data = await response.json()
    expect(data.error).toBe('AI features are currently unavailable')
    expect(mockStreamChunks).not.toHaveBeenCalled()
  })

  it('streams plain-text response on cache miss', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)
    getCachedAiResponseMock.mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')

    const text = await response.text()
    expect(text).toBe('Hello world')

    expect(logBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_chat_request',
        success: true,
        details: expect.objectContaining({ productId: 'abc1234' }),
      })
    )
    expect(waitUntilMock).toHaveBeenCalled()
  })

  it('returns cached JSON response on cache hit without calling stream', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)
    getCachedAiResponseMock.mockResolvedValue('Cached AI response')

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.text).toBe('Cached AI response')
    expect(mockStreamChunks).not.toHaveBeenCalled()
    expect(waitUntilMock).not.toHaveBeenCalled()
    expect(logBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ cached: true }),
      })
    )
  })

  it('schedules setCachedAiResponse via waitUntil on cache miss', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)
    getCachedAiResponseMock.mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    await response.text()

    expect(waitUntilMock).toHaveBeenCalledWith(expect.any(Promise))
    const waitUntilArg = waitUntilMock.mock.calls[0][0]
    await waitUntilArg
    expect(setCachedAiResponseMock).toHaveBeenCalledWith(
      'abc1234',
      'Is this product in stock?',
      'INR',
      'Hello world'
    )
  })

  it('does not cache multi-turn conversation responses', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)

    const multiTurnBody = {
      messages: [
        { role: 'user', text: 'What material is this?' },
        { role: 'assistant', text: 'It is made of cotton.' },
        { role: 'user', text: 'Does it come in blue?' },
      ],
    }

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(multiTurnBody) }
    )

    await POST(request, { params: Promise.resolve({ id: 'abc1234' }) })

    expect(getCachedAiResponseMock).not.toHaveBeenCalled()
    expect(waitUntilMock).not.toHaveBeenCalled()
  })

  it('formats prices using user currency preference when available', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as never)
    vi.mocked(drizzleDb.query.users.findFirst).mockResolvedValue({
      currencyPreference: 'EUR',
    } as never)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(200)
    expect(buildProductContextMock).toHaveBeenCalledWith(
      mockProduct,
      expect.objectContaining({
        currencyCode: 'EUR',
        formatPrice: expect.any(Function),
      })
    )
    expect(getCachedAiResponseMock).toHaveBeenCalledWith(
      'abc1234',
      'Is this product in stock?',
      'EUR'
    )
  })

  it('logs error with product context on failure', async () => {
    const testError = new Error('Network error')
    vi.mocked(db.products.findById).mockRejectedValue(testError)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      { method: 'POST', body: JSON.stringify(validBody) }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(500)
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: testError,
        context: 'ai_product_chat',
        additionalInfo: expect.objectContaining({ productId: 'abc1234' }),
      })
    )
  })
})
