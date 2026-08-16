import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleImageRequest } from '../../../workers/images/src/handler'

const ALLOWED_HOSTNAMES =
  'images.unsplash.com,lh3.googleusercontent.com,.public.blob.vercel-storage.com'

const makeRequest = (search: string, method = 'GET'): Request =>
  new Request(`https://images.example.com/?${search}`, { method })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('handleImageRequest', () => {
  it('rejects non-GET/HEAD methods', async () => {
    const response = await handleImageRequest(
      makeRequest('url=https://images.unsplash.com/photo.jpg&w=400', 'POST'),
      { ALLOWED_HOSTNAMES }
    )
    expect(response.status).toBe(405)
  })

  it('returns 400 with a descriptive body for invalid input', async () => {
    const response = await handleImageRequest(makeRequest('w=400'), {
      ALLOWED_HOSTNAMES,
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/url/i)
  })

  it('returns 403 for a disallowed hostname without ever calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await handleImageRequest(
      makeRequest('url=https://evil.example.com/photo.jpg&w=400'),
      { ALLOWED_HOSTNAMES }
    )

    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the source through cf.image and applies immutable caching', async () => {
    const originHeaders = new Headers({ 'content-type': 'image/jpeg' })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: originHeaders,
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await handleImageRequest(
      makeRequest(
        'url=https://images.unsplash.com/photo.jpg&w=800&q=80&f=webp'
      ),
      { ALLOWED_HOSTNAMES }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable'
    )
    expect(response.headers.get('vary')).toBe('Accept')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      { cf?: { image?: Record<string, unknown> } },
    ]
    expect(calledUrl).toBe('https://images.unsplash.com/photo.jpg')
    expect(calledInit.cf?.image).toEqual({
      width: 800,
      quality: 80,
      format: 'webp',
      fit: 'scale-down',
    })
  })

  it('omits an explicit format from cf.image when the request uses "auto"', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await handleImageRequest(
      makeRequest('url=https://images.unsplash.com/photo.jpg&w=400'),
      { ALLOWED_HOSTNAMES }
    )

    const [, calledInit] = fetchMock.mock.calls[0] as [
      string,
      { cf?: { image?: Record<string, unknown> } },
    ]
    expect(calledInit.cf?.image).toEqual({
      width: 400,
      quality: 75,
      fit: 'scale-down',
    })
  })

  it('returns 502 when the origin fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const response = await handleImageRequest(
      makeRequest('url=https://images.unsplash.com/photo.jpg&w=400'),
      { ALLOWED_HOSTNAMES }
    )
    expect(response.status).toBe(502)
  })

  it('returns 502 when the origin responds with a non-2xx status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    )

    const response = await handleImageRequest(
      makeRequest('url=https://images.unsplash.com/photo.jpg&w=400'),
      { ALLOWED_HOSTNAMES }
    )
    expect(response.status).toBe(502)
  })
})
