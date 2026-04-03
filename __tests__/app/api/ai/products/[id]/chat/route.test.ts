import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findById: vi.fn(),
    },
  },
}))

vi.mock('@/lib/ai/gateway', () => ({
  getAiConfigCached: vi.fn(() =>
    Promise.resolve({
      chatModel: 'openai/gpt-5-nano',
      embeddingModel: 'openai/text-embedding-3-small',
      maxResponseTokens: 512,
      maxContextChunks: 3,
      maxHistoryMessages: 10,
    })
  ),
  getChatModel: vi.fn(() => ({ modelId: 'openai/gpt-5-nano' })),
}))

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: vi.fn(
      () => new Response('streamed', { status: 200 })
    ),
  })),
  convertToModelMessages: vi.fn((msgs) => msgs),
}))

vi.mock('@/lib/ai/product-rag', () => ({
  buildProductContext: vi.fn(
    () =>
      'Name: Test Product\nCategory: Electronics\nPrice: $29.99\nStock: 100 units'
  ),
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

import { db } from '@/lib/db'
import { streamText } from 'ai'
import { logError, logBusinessEvent } from '@/lib/logger'
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
  variations: [],
}

const validBody = {
  messages: [
    {
      id: '1',
      role: 'user',
      parts: [{ type: 'text', text: 'Is this product in stock?' }],
    },
  ],
}

describe('POST /api/ai/products/[id]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when product not found', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost/api/ai/products/notfound/chat',
      {
        method: 'POST',
        body: JSON.stringify(validBody),
      }
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

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      {
        method: 'POST',
        body: JSON.stringify({ messages: 'not-an-array' }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(400)
  })

  it('streams response for valid request', async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      {
        method: 'POST',
        body: JSON.stringify(validBody),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc1234' }),
    })

    expect(response.status).toBe(200)
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Test Product'),
        messages: validBody.messages,
        maxOutputTokens: 512,
        abortSignal: expect.anything(),
      })
    )
    expect(logBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_chat_request',
        success: true,
        details: expect.objectContaining({ productId: 'abc1234' }),
      })
    )
  })

  it('logs error with product context on failure', async () => {
    const testError = new Error('Gateway timeout')
    vi.mocked(db.products.findById).mockRejectedValue(testError)

    const request = new NextRequest(
      'http://localhost/api/ai/products/abc1234/chat',
      {
        method: 'POST',
        body: JSON.stringify(validBody),
      }
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
