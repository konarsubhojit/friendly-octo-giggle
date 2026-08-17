import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { env } from '@/lib/env'
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
 * R2 is fronted by the S3-compatible API, so `@aws-sdk/client-s3` is used
 * purely as a protocol client — no AWS account or resource is ever involved.
 * The endpoint is R2's per-account URL; `forcePathStyle` is required because
 * R2 does not resolve virtual-hosted–style bucket subdomains.
 */
let cachedClient: S3Client | null = null

const getClient = (): S3Client => {
  if (cachedClient) return cachedClient

  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
    )
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })
  return cachedClient
}

const getBucket = (): string => {
  if (!env.R2_BUCKET) {
    throw new Error('Cloudflare R2 is not configured. Set R2_BUCKET.')
  }
  return env.R2_BUCKET
}

/** Public URL for `pathname`: a custom domain if configured, else the r2.dev bucket URL. */
const buildPublicUrl = (pathname: string): string => {
  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_PUBLIC_BASE_URL to the bucket public base URL.'
    )
  }
  const base = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
  return `${base}/${pathname}`
}

const toBodyBytes = async (body: StorageBody): Promise<Uint8Array> => {
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer())
  if (body instanceof Buffer) return body
  return body
}

/** True when an S3 SDK error represents "object not found" (HeadObject 404). */
const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String((error as { name: unknown }).name) : ''
  if (name === 'NotFound' || name === 'NoSuchKey') return true
  const metadata =
    'metadata' in error
      ? (error as { metadata?: unknown }).metadata
      : '$metadata' in error
        ? (error as { $metadata?: unknown }).$metadata
        : undefined
  const status =
    metadata && typeof metadata === 'object' && 'httpStatusCode' in metadata
      ? (metadata as { httpStatusCode?: number }).httpStatusCode
      : undefined
  return status === 404
}

export const createR2StorageAdapter = (): StorageAdapter => ({
  provider: 'r2',

  async put(
    pathname: string,
    body: StorageBody,
    options?: PutOptions
  ): Promise<PutResult> {
    const client = getClient()
    const bytes = await toBodyBytes(body)

    await client.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: pathname,
        Body: bytes,
        ContentType: options?.contentType ?? undefined,
        CacheControl: options?.cacheControl ?? IMMUTABLE_CACHE_CONTROL,
      })
    )

    return {
      url: buildPublicUrl(pathname),
      pathname,
      contentType: options?.contentType ?? null,
      provider: 'r2',
    }
  },

  async delete(pathname: string): Promise<void> {
    const client = getClient()
    await client.send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: pathname })
    )
  },

  async getUrl(pathname: string): Promise<string | null> {
    const client = getClient()
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: getBucket(), Key: pathname })
      )
      return buildPublicUrl(pathname)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  },

  async list(options?: ListOptions): Promise<ListResult> {
    const client = getClient()
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: options?.prefix,
        MaxKeys: options?.limit,
        ContinuationToken: options?.cursor,
      })
    )

    const objects = (response.Contents ?? [])
      .filter((entry): entry is typeof entry & { Key: string } =>
        Boolean(entry.Key)
      )
      .map((entry) => ({
        pathname: entry.Key,
        size: entry.Size ?? 0,
        uploadedAt: entry.LastModified ?? null,
      }))

    return {
      objects,
      cursor: response.NextContinuationToken,
      hasMore: response.IsTruncated ?? false,
    }
  },
})

/** Exposed for tests that need to reset the memoized client between cases. */
export const __resetR2ClientForTests = (): void => {
  cachedClient = null
}
