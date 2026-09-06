/**
 * Pure request validation for the image-resizing Worker.
 *
 * Kept dependency-free (no Cloudflare Workers types, no imports) so it can
 * be unit-tested with plain Vitest and bundled by Wrangler without any
 * extra toolchain configuration.
 *
 * Width/quality bounds intentionally mirror `src/lib/image-loader.ts`'s
 * `MIN_WIDTH`/`MAX_WIDTH`/`MIN_QUALITY`/`MAX_QUALITY`/`DEFAULT_QUALITY` — the
 * two modules ship in different bundles (Next.js app vs. Worker) so the
 * constants are duplicated rather than imported; a mismatch here would only
 * ever make the Worker reject an in-range request the loader already
 * clamped, never the other way round, but if either changes both must.
 */

export const MIN_WIDTH = 16
export const MAX_WIDTH = 3840
export const MIN_QUALITY = 1
export const MAX_QUALITY = 100
export const DEFAULT_QUALITY = 75

export const ALLOWED_FORMATS = ['avif', 'webp', 'auto'] as const
export type AllowedFormat = (typeof ALLOWED_FORMATS)[number]

export interface ValidatedImageRequest {
  readonly sourceUrl: string
  readonly width: number
  readonly quality: number
  readonly format: AllowedFormat
}

export type ValidationFailure =
  | { readonly kind: 'missing_url' }
  | { readonly kind: 'invalid_url' }
  | { readonly kind: 'disallowed_hostname'; readonly hostname: string }
  | { readonly kind: 'missing_width' }
  | { readonly kind: 'invalid_width' }
  | { readonly kind: 'invalid_quality' }
  | { readonly kind: 'invalid_format' }

export type ValidationResult =
  | { readonly ok: true; readonly request: ValidatedImageRequest }
  | { readonly ok: false; readonly failure: ValidationFailure }

/**
 * Check `hostname` against a comma-separated allow-list.
 *
 * An entry starting with `.` matches that suffix on any subdomain (e.g.
 * `.public.blob.vercel-storage.com` allows
 * `abc123.public.blob.vercel-storage.com` but not a bare
 * `public.blob.vercel-storage.com` impersonation of the suffix without a
 * subdomain, and never matches `evilpublic.blob.vercel-storage.com` because
 * the dot is part of the match). Every other entry must match exactly —
 * there is no `*` wildcard, so a typo in configuration fails closed rather
 * than opening unpredictably.
 */
export const isAllowedHostname = (
  hostname: string,
  allowList: string
): boolean => {
  const entries = allowList
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  const target = hostname.toLowerCase()

  return entries.some((entry) => {
    if (entry.startsWith('.')) return target.endsWith(entry)
    return target === entry
  })
}

/** Parses a required non-negative integer query parameter, or `null` if absent/malformed. */
const parseIntParam = (raw: string | null): number | null => {
  if (raw === null || !/^\d+$/.test(raw)) return null
  const value = Number.parseInt(raw, 10)
  return Number.isSafeInteger(value) ? value : null
}

/**
 * Validate an image-resizing request's query string.
 *
 * `url` and `w` are required; `q` and `f` are optional and default to
 * {@link DEFAULT_QUALITY} and `'auto'`. Every failure is reported as a
 * distinct, specific reason rather than a single generic "bad request" —
 * both for operator debuggability and so the unit tests can assert on
 * exactly which rule rejected a given input.
 */
export const validateImageRequest = (
  requestUrl: URL,
  allowedHostnames: string
): ValidationResult => {
  const rawSourceUrl = requestUrl.searchParams.get('url')
  if (!rawSourceUrl) return { ok: false, failure: { kind: 'missing_url' } }

  let source: URL
  try {
    source = new URL(rawSourceUrl)
  } catch {
    return { ok: false, failure: { kind: 'invalid_url' } }
  }

  if (source.protocol !== 'https:') {
    return { ok: false, failure: { kind: 'invalid_url' } }
  }

  if (!isAllowedHostname(source.hostname, allowedHostnames)) {
    return {
      ok: false,
      failure: { kind: 'disallowed_hostname', hostname: source.hostname },
    }
  }

  const rawWidth = requestUrl.searchParams.get('w')
  if (rawWidth === null)
    return { ok: false, failure: { kind: 'missing_width' } }
  const width = parseIntParam(rawWidth)
  if (width === null || width < MIN_WIDTH || width > MAX_WIDTH) {
    return { ok: false, failure: { kind: 'invalid_width' } }
  }

  const rawQuality = requestUrl.searchParams.get('q')
  let quality = DEFAULT_QUALITY
  if (rawQuality !== null) {
    const parsedQuality = parseIntParam(rawQuality)
    if (
      parsedQuality === null ||
      parsedQuality < MIN_QUALITY ||
      parsedQuality > MAX_QUALITY
    ) {
      return { ok: false, failure: { kind: 'invalid_quality' } }
    }
    quality = parsedQuality
  }

  const rawFormat = requestUrl.searchParams.get('f')
  const format = rawFormat ?? 'auto'
  if (!(ALLOWED_FORMATS as readonly string[]).includes(format)) {
    return { ok: false, failure: { kind: 'invalid_format' } }
  }

  return {
    ok: true,
    request: {
      sourceUrl: source.toString(),
      width,
      quality,
      format: format as AllowedFormat,
    },
  }
}

/** Human-readable message for a validation failure, used in the 400 body. */
export const describeValidationFailure = (
  failure: ValidationFailure
): string => {
  switch (failure.kind) {
    case 'missing_url':
      return 'Missing required "url" query parameter.'
    case 'invalid_url':
      return '"url" must be an absolute https:// URL.'
    case 'disallowed_hostname':
      return `Hostname "${failure.hostname}" is not on the allow-list.`
    case 'missing_width':
      return 'Missing required "w" (width) query parameter.'
    case 'invalid_width':
      return `"w" must be an integer between ${MIN_WIDTH} and ${MAX_WIDTH}.`
    case 'invalid_quality':
      return `"q" must be an integer between ${MIN_QUALITY} and ${MAX_QUALITY}.`
    case 'invalid_format':
      return `"f" must be one of: ${ALLOWED_FORMATS.join(', ')}.`
    default:
      return 'Invalid image request.'
  }
}
