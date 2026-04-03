import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/logger', () => ({
  logApiRequest: vi.fn(),
  generateRequestId: vi.fn().mockReturnValue('req-test-id'),
  Timer: class MockTimer {
    end = vi.fn().mockReturnValue(42)
    constructor(_label: string) {}
  },
  logError: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

function mockRequest(method = 'GET', pathname = '/api/test'): NextRequest {
  return {
    method,
    nextUrl: { pathname },
    headers: {
      set: vi.fn(),
      get: vi.fn(),
    },
  } as unknown as NextRequest
}

function mockResponse(status = 200): NextResponse {
  const headers = new Map<string, string>()
  return {
    status,
    headers: {
      set: (key: string, value: string) => headers.set(key, value),
      get: (key: string) => headers.get(key),
    },
    _headers: headers,
  } as unknown as NextResponse
}

describe('withApiLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the handler and returns its response', async () => {
    const { withApiLogging } = await import('@/lib/api-middleware')
    const response = mockResponse(200)
    const handler = vi.fn().mockResolvedValue(response)
    const wrapped = withApiLogging(handler)
    const req = mockRequest()
    const result = await wrapped(req)
    expect(handler).toHaveBeenCalledOnce()
    expect(result).toBe(response)
  })

  it('sets X-Request-ID header on response', async () => {
    const { withApiLogging } = await import('@/lib/api-middleware')
    const response = mockResponse(200)
    const handler = vi.fn().mockResolvedValue(response)
    const wrapped = withApiLogging(handler)
    await wrapped(mockRequest())
    expect(response.headers.get('X-Request-ID')).toBe('req-test-id')
  })

  it('rethrows handler errors after logging', async () => {
    const { withApiLogging } = await import('@/lib/api-middleware')
    const handler = vi.fn().mockRejectedValue(new Error('Handler crash'))
    const wrapped = withApiLogging(handler)
    await expect(wrapped(mockRequest())).rejects.toThrow('Handler crash')
  })

  it('logs API request details', async () => {
    const { withApiLogging } = await import('@/lib/api-middleware')
    const { logApiRequest } = await import('@/lib/logger')
    const response = mockResponse(201)
    const handler = vi.fn().mockResolvedValue(response)
    const wrapped = withApiLogging(handler)
    await wrapped(mockRequest('POST', '/api/products'))
    expect(logApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/products',
        requestId: 'req-test-id',
        statusCode: 201,
      })
    )
  })

  it('passes context with requestId and timer to handler', async () => {
    const { withApiLogging } = await import('@/lib/api-middleware')
    const response = mockResponse(200)
    let capturedContext: unknown
    const handler = vi.fn().mockImplementation((_req, ctx) => {
      capturedContext = ctx
      return Promise.resolve(response)
    })
    const wrapped = withApiLogging(handler)
    await wrapped(mockRequest())
    expect(capturedContext).toMatchObject({
      requestId: 'req-test-id',
    })
  })
})

describe('withLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the handler and returns its response', async () => {
    const { withLogging } = await import('@/lib/api-middleware')
    const response = mockResponse(200)
    const handler = vi.fn().mockResolvedValue(response)
    const wrapped = withLogging(handler)
    const result = await wrapped(mockRequest())
    expect(handler).toHaveBeenCalledOnce()
    expect(result).toBe(response)
  })

  it('sets X-Request-ID header', async () => {
    const { withLogging } = await import('@/lib/api-middleware')
    const response = mockResponse(200)
    const handler = vi.fn().mockResolvedValue(response)
    const wrapped = withLogging(handler)
    await wrapped(mockRequest())
    expect(response.headers.get('X-Request-ID')).toBe('req-test-id')
  })

  it('rethrows errors after logging', async () => {
    const { withLogging } = await import('@/lib/api-middleware')
    const handler = vi.fn().mockRejectedValue(new Error('Crash'))
    const wrapped = withLogging(handler)
    await expect(wrapped(mockRequest())).rejects.toThrow('Crash')
  })

  it('logs request with correct details', async () => {
    const { withLogging } = await import('@/lib/api-middleware')
    const { logApiRequest } = await import('@/lib/logger')
    const response = mockResponse(404)
    const handler = vi.fn().mockResolvedValue(response)
    const wrapped = withLogging(handler)
    await wrapped(mockRequest('GET', '/api/missing'))
    expect(logApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/missing',
        statusCode: 404,
      })
    )
  })
})
