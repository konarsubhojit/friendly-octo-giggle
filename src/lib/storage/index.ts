import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { createR2StorageAdapter } from './r2'
import { createVercelStorageAdapter } from './vercel'
import type { StorageAdapter, StorageProviderName } from './types'

export * from './types'
export { createR2StorageAdapter } from './r2'
export { createVercelStorageAdapter } from './vercel'

/** The provider new writes go to. Reads may still fall back to the other. */
export const getActiveProvider = (): StorageProviderName =>
  env.STORAGE_PROVIDER === 'r2' ? 'r2' : 'vercel'

let vercelAdapter: StorageAdapter | null = null
let r2Adapter: StorageAdapter | null = null

const getVercelAdapter = (): StorageAdapter => {
  if (!vercelAdapter) vercelAdapter = createVercelStorageAdapter()
  return vercelAdapter
}

const getR2Adapter = (): StorageAdapter => {
  if (!r2Adapter) r2Adapter = createR2StorageAdapter()
  return r2Adapter
}

/** The adapter for a specific provider, regardless of `STORAGE_PROVIDER`. */
export const getStorageAdapterFor = (
  provider: StorageProviderName
): StorageAdapter => (provider === 'r2' ? getR2Adapter() : getVercelAdapter())

/** The adapter new uploads are written through, selected by `STORAGE_PROVIDER`. */
export const getStorageAdapter = (): StorageAdapter =>
  getStorageAdapterFor(getActiveProvider())

/**
 * Resolve `pathname` to a public URL, reading through the active provider
 * first and falling back to the other provider when the object is not
 * there.
 *
 * This is what makes a `STORAGE_PROVIDER=r2` cutover safe before every
 * historical object has been migrated (see
 * `scripts/migrate-storage-to-r2.ts`): an object not yet copied to R2 is
 * still served, from Vercel, instead of 404ing. Every fallback is logged
 * with structured fields so migration progress — and any object missing
 * from *both* providers — is observable rather than silently degraded.
 */
export const resolveStorageUrl = async (
  pathname: string
): Promise<string | null> => {
  const primary = getActiveProvider()
  const fallback: StorageProviderName = primary === 'r2' ? 'vercel' : 'r2'

  const primaryUrl = await getStorageAdapterFor(primary).getUrl(pathname)
  if (primaryUrl) return primaryUrl

  logger.warn(
    {
      type: 'storage_dual_read_fallback',
      pathname,
      primaryProvider: primary,
      fallbackProvider: fallback,
    },
    `Storage dual-read: ${pathname} missing from ${primary}, trying ${fallback}`
  )

  const fallbackUrl = await getStorageAdapterFor(fallback).getUrl(pathname)
  if (fallbackUrl) return fallbackUrl

  logger.error(
    {
      type: 'storage_dual_read_miss',
      pathname,
      primaryProvider: primary,
      fallbackProvider: fallback,
    },
    `Storage dual-read: ${pathname} missing from both ${primary} and ${fallback}`
  )
  return null
}

/** Exposed for tests that need to reset the memoized adapters between cases. */
export const __resetStorageAdaptersForTests = (): void => {
  vercelAdapter = null
  r2Adapter = null
}
