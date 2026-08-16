import {
  describeValidationFailure,
  validateImageRequest,
  type ValidationFailure,
} from './validation'

/**
 * Bindings/vars this Worker needs, declared as a plain interface rather than
 * `@cloudflare/workers-types`' `Fetcher`/`ExecutionContext` so this module
 * has zero dependencies beyond the language itself.
 */
export interface Env {
  /**
   * Comma-separated hostname allow-list checked against the `url` query
   * parameter (see `isAllowedHostname` in `./validation`). Configured per
   * environment in `wrangler.toml`.
   */
  readonly ALLOWED_HOSTNAMES: string
}

/** Long-lived: object keys are unique (UUID-based), so a given transform of a given source URL never changes. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** A year, in seconds — Cloudflare's edge cache TTL for a resized variant. */
const EDGE_CACHE_TTL_SECONDS = 31536000

const jsonError = (status: number, message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const statusForFailure = (failure: ValidationFailure): number =>
  failure.kind === 'disallowed_hostname' ? 403 : 400

/**
 * Cloudflare's `fetch` accepts a `cf` option that is not part of the
 * standard `RequestInit` type (it is added by the Workers runtime). Typed
 * narrowly here instead of pulling in `@cloudflare/workers-types` for a
 * single field.
 */
interface CfImageFetchInit extends RequestInit {
  readonly cf?: {
    readonly image?: {
      readonly width?: number
      readonly quality?: number
      readonly format?: 'avif' | 'webp'
      readonly fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
    }
    readonly cacheEverything?: boolean
    readonly cacheTtl?: number
  }
}

/**
 * Handle one image-resizing request.
 *
 * Contract: `GET /?url=<https source>&w=<width>&q=<quality>&f=<format>`.
 * `url`'s hostname must be on `env.ALLOWED_HOSTNAMES`; `w` is required and
 * clamped to a strict range; `q` and `f` are optional. On success, the
 * origin image is fetched through Cloudflare's Image Resizing (`cf.image`)
 * and served back with an immutable, long-lived `Cache-Control` — the
 * query string (source URL + width + quality + format) is the full cache
 * key, and every one of those is fixed for a given object, so the response
 * bytes for a given request URL never change.
 *
 * Dual-provider (R2 primary, Vercel fallback) read resolution happens
 * upstream of this Worker, in `resolveStorageUrl`
 * (`src/lib/storage/index.ts`) — by the time a request reaches here, `url`
 * is already a single concrete, reachable source.
 */
export const handleImageRequest = async (
  request: Request,
  env: Env
): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonError(405, 'Only GET and HEAD are supported.')
  }

  const requestUrl = new URL(request.url)
  const result = validateImageRequest(requestUrl, env.ALLOWED_HOSTNAMES ?? '')
  if (!result.ok) {
    return jsonError(
      statusForFailure(result.failure),
      describeValidationFailure(result.failure)
    )
  }

  const { sourceUrl, width, quality, format } = result.request

  const fetchInit: CfImageFetchInit = {
    cf: {
      image: {
        width,
        quality,
        // 'auto' is the absence of an explicit format: Cloudflare then
        // negotiates avif/webp from the request's own Accept header.
        ...(format === 'auto' ? {} : { format }),
        fit: 'scale-down',
      },
      cacheEverything: true,
      cacheTtl: EDGE_CACHE_TTL_SECONDS,
    },
  }

  let originResponse: Response
  try {
    originResponse = await fetch(sourceUrl, fetchInit)
  } catch {
    return jsonError(502, 'Failed to fetch the source image.')
  }

  if (!originResponse.ok) {
    return jsonError(
      502,
      `Source image responded with HTTP ${originResponse.status}.`
    )
  }

  const headers = new Headers(originResponse.headers)
  headers.set('Cache-Control', IMMUTABLE_CACHE_CONTROL)
  // The transform depends on the request's Accept header when format is
  // 'auto' (see the cf.image comment above), so downstream/browser caches
  // must not conflate an avif response with a webp one for the same URL.
  headers.set('Vary', 'Accept')

  return new Response(originResponse.body, {
    status: originResponse.status,
    headers,
  })
}
