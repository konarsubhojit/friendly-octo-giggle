import {
  getActiveProvider,
  getStorageAdapterFor,
  IMMUTABLE_CACHE_CONTROL,
  type StorageProviderName,
} from '@/lib/storage'

/** The image-storage-specific alias for the storage layer's provider type —
 * kept so existing callers of `uploadImage` do not need to change their
 * import. */
export type ImageStorageProvider = StorageProviderName

export interface UploadImageOptions {
  readonly provider?: ImageStorageProvider
}

export interface UploadedImage {
  readonly url: string
  readonly pathname: string
  readonly contentType: string | null
  readonly provider: ImageStorageProvider
}

const getFileExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf('.')
  if (index === -1) return ''
  const ext = fileName.slice(index)
  return /^[.][a-zA-Z0-9]+$/.test(ext) ? ext.toLowerCase() : ''
}

const buildObjectKey = (fileName: string): string => {
  const ext = getFileExtension(fileName)
  return `images/${crypto.randomUUID()}${ext}`
}

/**
 * Upload an image file to the configured storage backend.
 *
 * The provider is selected in the following order:
 * 1. `options.provider` (when provided).
 * 2. `STORAGE_PROVIDER` (falls back to `'vercel'` when unset or unrecognized).
 *
 * All actual storage access is delegated to the provider-neutral adapters in
 * `@/lib/storage`; this function's job is solely to pick the adapter and
 * derive a unique object key from the uploaded file name.
 *
 * @param file - The browser `File` to upload.
 * @param options - Optional storage selection override.
 * @returns The uploaded image metadata: public URL, object key ("pathname"),
 *   content type, and the provider actually used.
 *
 * @example
 * ```ts
 * const uploaded = await uploadImage(file, { provider: 'r2' })
 * console.log(uploaded.url)
 * ```
 */
export async function uploadImage(
  file: File,
  options: UploadImageOptions = {}
): Promise<UploadedImage> {
  const provider = options.provider ?? getActiveProvider()
  const adapter = getStorageAdapterFor(provider)

  const pathname = buildObjectKey(file.name)
  const data = Buffer.from(await file.arrayBuffer())

  const result = await adapter.put(pathname, data, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  })

  return {
    url: result.url,
    pathname: result.pathname,
    contentType: file.type || null,
    provider: result.provider,
  }
}
