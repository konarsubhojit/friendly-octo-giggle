/**
 * Provider-neutral object storage contract.
 *
 * Every concrete backend (Cloudflare R2, Vercel Blob, …) implements this
 * interface so callers — `src/lib/image-storage.ts`, the migration script,
 * and any future consumer — never branch on the provider directly. Adding a
 * third backend means adding one adapter module and one line in the
 * `STORAGE_PROVIDER` switch in `index.ts`; nothing else in the codebase
 * changes.
 */

/** The set of backends the application knows how to talk to. */
export type StorageProviderName = 'vercel' | 's3' | 'r2'

/** Bytes accepted by `put`. Mirrors what a Node.js server route can produce. */
export type StorageBody = Blob | Buffer | Uint8Array

export interface PutOptions {
  /** MIME type stored alongside the object and served back on read. */
  readonly contentType?: string | null
  /**
   * `Cache-Control` header value applied to the stored object.
   * Defaults to a long, immutable value — object keys are unique
   * (UUID-based), so a stored object's bytes never change under the same
   * key, which is exactly what `immutable` promises to caches.
   */
  readonly cacheControl?: string
}

export interface PutResult {
  /** Publicly reachable URL for the stored object. */
  readonly url: string
  /** The storage key the object was written under. */
  readonly pathname: string
  readonly contentType: string | null
  readonly provider: StorageProviderName
}

export interface ListedObject {
  readonly pathname: string
  readonly size: number
  readonly uploadedAt: Date | null
}

export interface ListOptions {
  /** Only return objects whose key starts with this prefix. */
  readonly prefix?: string
  /** Maximum number of objects to return in one page. */
  readonly limit?: number
  /** Opaque pagination cursor returned by a previous `list` call. */
  readonly cursor?: string
}

export interface ListResult {
  readonly objects: ListedObject[]
  /** Present when more results are available; pass back into `list`. */
  readonly cursor?: string
  readonly hasMore: boolean
}

/**
 * The minimal operation set every storage adapter must implement:
 * write, delete, resolve-a-URL, and enumerate. Deliberately small — adapters
 * are plumbing, not a place for business logic (naming, validation, and
 * fallback behavior live in `src/lib/image-storage.ts` and `index.ts`).
 */
export interface StorageAdapter {
  readonly provider: StorageProviderName

  /** Write `body` under `pathname`, returning its public URL. */
  put(
    pathname: string,
    body: StorageBody,
    options?: PutOptions
  ): Promise<PutResult>

  /** Remove the object at `pathname`. A missing object is not an error. */
  delete(pathname: string): Promise<void>

  /**
   * Resolve `pathname` to a public URL, or `null` if no object exists at
   * that key in this provider. Used for read-side dual-provider fallback
   * during a storage migration.
   */
  getUrl(pathname: string): Promise<string | null>

  /** Enumerate stored objects, optionally scoped to a key prefix. */
  list(options?: ListOptions): Promise<ListResult>
}

/** Default `Cache-Control` for uploaded images: unique keys, so immutable. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
