import { del, head, list, put, BlobNotFoundError } from '@vercel/blob'
import type {
  ListOptions,
  ListResult,
  PutOptions,
  PutResult,
  StorageAdapter,
  StorageBody,
} from './types'
import { IMMUTABLE_CACHE_CONTROL } from './types'

/**
 * Vercel Blob adapter — the original, and still-supported, backend.
 *
 * Uploads use `addRandomSuffix: false` so the object key we generate
 * (`images/<uuid>.<ext>`, see `image-storage.ts`) is exactly the pathname
 * Vercel stores it under. That determinism is what makes read-side
 * dual-provider fallback possible: given only a pathname, `getUrl` can find
 * the object without the caller having stored the original upload URL.
 */
export const createVercelStorageAdapter = (): StorageAdapter => ({
  provider: 'vercel',

  async put(
    pathname: string,
    body: StorageBody,
    options?: PutOptions
  ): Promise<PutResult> {
    // `@vercel/blob`'s `put` accepts Blob/Buffer/Readable/File but not a
    // raw Uint8Array; Buffer wraps one without copying.
    const putBody = body instanceof Uint8Array ? Buffer.from(body) : body
    const blob = await put(pathname, putBody, {
      access: 'public',
      addRandomSuffix: false,
      contentType: options?.contentType ?? undefined,
      // Vercel Blob takes a max-age in seconds rather than a raw
      // Cache-Control string; 31536000s (1 year) is the numeric equivalent
      // of IMMUTABLE_CACHE_CONTROL's max-age, which is the part Vercel
      // actually honors.
      cacheControlMaxAge: 31536000,
    })

    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType ?? options?.contentType ?? null,
      provider: 'vercel',
    }
  },

  async delete(pathname: string): Promise<void> {
    await del(pathname)
  },

  async getUrl(pathname: string): Promise<string | null> {
    try {
      const result = await head(pathname)
      return result.url
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null
      throw error
    }
  },

  async list(options?: ListOptions): Promise<ListResult> {
    const result = await list({
      prefix: options?.prefix,
      limit: options?.limit,
      cursor: options?.cursor,
    })

    return {
      objects: result.blobs.map((blob) => ({
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      })),
      cursor: result.cursor,
      hasMore: result.hasMore,
    }
  },
})

// Retained for documentation purposes at call sites that need the default
// Cache-Control value without constructing an adapter.
export { IMMUTABLE_CACHE_CONTROL as VERCEL_CACHE_CONTROL }
