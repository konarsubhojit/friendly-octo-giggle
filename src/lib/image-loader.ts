/**
 * Global Next.js custom image loader.
 *
 * Every `next/image` render (`images.loader: 'custom'` in `next.config.ts`)
 * calls this function instead of Next's built-in `/_next/image` optimizer.
 * It routes the request to the Cloudflare Worker under `workers/images/`,
 * which validates and resizes at the edge via `cf.image` (see
 * `workers/images/src/handler.ts`).
 *
 * Width and quality are clamped here, in addition to the Worker's own
 * validation, so an out-of-range value never even reaches the network —
 * `next/image` computes candidate widths from `deviceSizes`/`imageSizes` in
 * `next.config.ts`, and a future edit to those arrays is guarded by the same
 * clamp rather than only by the Worker's independent copy of the same
 * limits.
 */

/** Smallest width the image Worker will resize to. */
export const MIN_WIDTH = 16
/** Largest width the image Worker will resize to (4K-class display). */
export const MAX_WIDTH = 3840
export const MIN_QUALITY = 1
export const MAX_QUALITY = 100
/** Matches `next.config.ts`'s implicit default and the Worker's fallback. */
export const DEFAULT_QUALITY = 75

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)))

export const clampWidth = (width: number): number =>
  clamp(width, MIN_WIDTH, MAX_WIDTH)

export const clampQuality = (quality: number): number =>
  clamp(quality, MIN_QUALITY, MAX_QUALITY)

export interface ImageLoaderParams {
  readonly src: string
  readonly width: number
  readonly quality?: number
}

/**
 * The Worker's public base URL (e.g. `https://images.example.com`).
 *
 * Read as a `NEXT_PUBLIC_*` variable — not through `@/lib/env` — because
 * this module runs in the browser bundle as well as on the server, and
 * `@/lib/env` validates server-only variables (`DATABASE_URL`, etc.) that
 * must never ship to the client.
 */
const getWorkerBaseUrl = (): string | undefined => {
  const value = process.env.NEXT_PUBLIC_IMAGE_WORKER_URL
  return value && value.trim().length > 0 ? value.trim() : undefined
}

/**
 * Build the URL `next/image` renders for a given source, width, and
 * quality.
 *
 * When no Worker URL is configured (e.g. local development without the
 * Worker deployed), `src` is returned unchanged so images still render,
 * just unoptimized — this loader must never be the reason an image fails
 * to load.
 */
export function imageLoader({
  src,
  width,
  quality,
}: ImageLoaderParams): string {
  const workerBaseUrl = getWorkerBaseUrl()
  if (!workerBaseUrl) return src

  const clampedWidth = clampWidth(width)
  const clampedQuality = clampQuality(quality ?? DEFAULT_QUALITY)

  const params = new URLSearchParams({
    url: src,
    w: String(clampedWidth),
    q: String(clampedQuality),
  })

  return `${workerBaseUrl.replace(/\/+$/, '')}/?${params.toString()}`
}

export default imageLoader
