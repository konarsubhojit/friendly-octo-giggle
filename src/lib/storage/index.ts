import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { PROVIDER_REQUIRED_KEYS, resolveProviders } from '@/lib/providers/resolution'
import { createR2StorageAdapter } from './r2'
import { createS3StorageAdapter } from './s3'
import { createVercelStorageAdapter } from './vercel'
import type { StorageAdapter, StorageProviderName } from './types'

export * from './types'
export { createR2StorageAdapter } from './r2'
export { createS3StorageAdapter } from './s3'
export { createVercelStorageAdapter } from './vercel'

/**
 * The provider new writes go to. Reads may still fall back to other
 * configured providers.
 *
 * The decision comes from the centralized resolution path rather than from a
 * local `env.STORAGE_PROVIDER` test, so storage follows the same precedence
 * table as every other capability.
 */
export const getActiveProvider = (): StorageProviderName => {
  return resolveProviders(env).selections.storage.provider
}

let vercelAdapter: StorageAdapter | null = null
let s3Adapter: StorageAdapter | null = null
let r2Adapter: StorageAdapter | null = null

const getVercelAdapter = (): StorageAdapter => {
  if (!vercelAdapter) vercelAdapter = createVercelStorageAdapter()
  return vercelAdapter
}

const getR2Adapter = (): StorageAdapter => {
  if (!r2Adapter) r2Adapter = createR2StorageAdapter()
  return r2Adapter
}

const getS3Adapter = (): StorageAdapter => {
  if (!s3Adapter) s3Adapter = createS3StorageAdapter()
  return s3Adapter
}

/** The adapter for a specific provider, regardless of `STORAGE_PROVIDER`. */
export const getStorageAdapterFor = (
  provider: StorageProviderName
): StorageAdapter =>
  provider === 'r2'
    ? getR2Adapter()
    : provider === 's3'
      ? getS3Adapter()
      : getVercelAdapter()

/** The adapter new uploads are written through, selected by `STORAGE_PROVIDER`. */
export const getStorageAdapter = (): StorageAdapter =>
  getStorageAdapterFor(getActiveProvider())

/**
 * Resolve `pathname` to a public URL, reading through the active provider
 * first and falling back to configured secondary providers when the object is
 * not there (or the primary read fails).
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
  const fallbackProviders = getFallbackProviders(primary)

  let primaryError: unknown
  try {
    const primaryUrl = await getStorageAdapterFor(primary).getUrl(pathname)
    if (primaryUrl) return primaryUrl
  } catch (error) {
    primaryError = error
    logger.warn(
      {
        type: 'storage_primary_read_error',
        pathname,
        primaryProvider: primary,
        error,
      },
      `Storage read: ${pathname} failed on ${primary}, trying fallbacks`
    )
  }

  const attemptedFallbacks: StorageProviderName[] = []
  for (const fallbackProvider of fallbackProviders) {
    attemptedFallbacks.push(fallbackProvider)
    logger.warn(
      {
        type: 'storage_dual_read_fallback',
        pathname,
        primaryProvider: primary,
        fallbackProvider,
      },
      `Storage dual-read: ${pathname} missing from ${primary}, trying ${fallbackProvider}`
    )

    try {
      const fallbackUrl =
        await getStorageAdapterFor(fallbackProvider).getUrl(pathname)
      if (fallbackUrl) return fallbackUrl
    } catch (fallbackError) {
      logger.warn(
        {
          type: 'storage_fallback_read_error',
          pathname,
          primaryProvider: primary,
          fallbackProvider,
          error: fallbackError,
        },
        `Storage fallback read failed for ${pathname} on ${fallbackProvider}`
      )
    }
  }

  logger.error(
    {
      type: 'storage_dual_read_miss',
      pathname,
      primaryProvider: primary,
      fallbackProviders: attemptedFallbacks,
      primaryError: primaryError
        ? primaryError instanceof Error
          ? primaryError.message
          : String(primaryError)
        : undefined,
    },
    `Storage dual-read: ${pathname} not found in ${primary}${
      attemptedFallbacks.length > 0
        ? ` or fallbacks (${attemptedFallbacks.join(', ')})`
        : ''
    }`
  )
  return null
}

/** Exposed for tests that need to reset the memoized adapters between cases. */
export const __resetStorageAdaptersForTests = (): void => {
  vercelAdapter = null
  s3Adapter = null
  r2Adapter = null
}

const hasRequiredKeys = (keys: readonly string[]): boolean =>
  keys.every((key) => {
    const value = (env as Record<string, string | undefined>)[key]
    return typeof value === 'string' && value.trim().length > 0
  })

const isFallbackProviderConfigured = (provider: StorageProviderName): boolean => {
  if (provider === 'vercel') {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
  }
  return hasRequiredKeys(PROVIDER_REQUIRED_KEYS.storage[provider])
}

const FALLBACK_ENV_BY_PRIMARY: Record<StorageProviderName, keyof typeof env> = {
  vercel: 'STORAGE_FALLBACK_VERCEL',
  r2: 'STORAGE_FALLBACK_R2',
  s3: 'STORAGE_FALLBACK_S3',
}

const DEFAULT_FALLBACKS: Record<StorageProviderName, readonly StorageProviderName[]> =
  {
    vercel: ['r2', 's3'],
    r2: ['vercel', 's3'],
    s3: ['r2', 'vercel'],
  }

const parseFallbackProviderList = (
  raw: string | undefined
): StorageProviderName[] => {
  if (!raw) return []
  const legal = new Set<StorageProviderName>(['vercel', 'r2', 's3'])
  const seen = new Set<StorageProviderName>()
  const providers: StorageProviderName[] = []
  for (const item of raw.split(',')) {
    const normalized = item.trim().toLowerCase() as StorageProviderName
    if (!legal.has(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    providers.push(normalized)
  }
  return providers
}

const getConfiguredFallbackCandidates = (
  primary: StorageProviderName
): StorageProviderName[] => {
  const perProvider = env[FALLBACK_ENV_BY_PRIMARY[primary]]
  const global = env.STORAGE_FALLBACK_PROVIDERS
  const parsed = parseFallbackProviderList(perProvider ?? global)
  return parsed.length > 0 ? parsed : [...DEFAULT_FALLBACKS[primary]]
}

const getFallbackProviders = (
  primary: StorageProviderName
): StorageProviderName[] =>
  getConfiguredFallbackCandidates(primary).filter(
    (provider) => provider !== primary && isFallbackProviderConfigured(provider)
  )
