import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Agent as HttpsAgent } from 'node:https'
import { env } from '@/lib/env'
import type {
  ListOptions,
  ListResult,
  PutOptions,
  PutResult,
  StorageAdapter,
  StorageBody,
  StorageProviderName,
} from './types'
import { IMMUTABLE_CACHE_CONTROL } from './types'

interface S3AdapterConfig {
  readonly provider: Extract<StorageProviderName, 's3' | 'r2'>
  readonly endpoint?: string
  readonly region: string
  readonly bucket: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly publicBaseUrl: string
  readonly forcePathStyle: boolean
  readonly caCertPem?: string
}

const isSet = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0

const buildPublicUrl = (pathname: string, baseUrl: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/${pathname}`

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

const assertEndpointSecurity = ({
  endpoint,
  provider,
}: Pick<S3AdapterConfig, 'endpoint' | 'provider'>): void => {
  if (!isSet(endpoint)) return

  let parsed: URL
  try {
    parsed = new URL(endpoint)
  } catch {
    throw new Error(
      `${provider.toUpperCase()} endpoint must be a valid URL. Received: ${endpoint}`
    )
  }

  if (parsed.protocol === 'http:' && env.NODE_ENV === 'production') {
    throw new Error(
      `${provider.toUpperCase()} endpoint must use HTTPS in production.`
    )
  }
}

const buildClient = (config: S3AdapterConfig): S3Client => {
  assertEndpointSecurity(config)

  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestHandler: config.caCertPem
      ? new NodeHttpHandler({
          httpsAgent: new HttpsAgent({ ca: config.caCertPem }),
        })
      : undefined,
  })
}

const s3ConfigFromEnv = (): S3AdapterConfig => {
  if (
    !isSet(env.S3_REGION) ||
    !isSet(env.S3_BUCKET) ||
    !isSet(env.S3_ACCESS_KEY_ID) ||
    !isSet(env.S3_SECRET_ACCESS_KEY) ||
    !isSet(env.S3_PUBLIC_BASE_URL)
  ) {
    throw new Error(
      'S3 storage is not configured. Set S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_BASE_URL.'
    )
  }

  return {
    provider: 's3',
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    caCertPem: env.S3_CA_CERT_PEM,
  }
}

const r2ConfigFromEnv = (): S3AdapterConfig => {
  if (
    !isSet(env.R2_ACCOUNT_ID) ||
    !isSet(env.R2_ACCESS_KEY_ID) ||
    !isSet(env.R2_SECRET_ACCESS_KEY) ||
    !isSet(env.R2_BUCKET) ||
    !isSet(env.R2_PUBLIC_BASE_URL)
  ) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL.'
    )
  }

  return {
    provider: 'r2',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
    forcePathStyle: true,
  }
}

let cachedS3Client: S3Client | null = null
let cachedR2Client: S3Client | null = null

const createS3LikeStorageAdapter = (
  resolveConfig: () => S3AdapterConfig
): StorageAdapter => ({
  get provider() {
    return resolveConfig().provider
  },

  async put(
    pathname: string,
    body: StorageBody,
    options?: PutOptions
  ): Promise<PutResult> {
    const config = resolveConfig()
    const bytes = await toBodyBytes(body)
    const client =
      config.provider === 's3'
        ? (cachedS3Client ??= buildClient(config))
        : (cachedR2Client ??= buildClient(config))

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: pathname,
        Body: bytes,
        ContentType: options?.contentType ?? undefined,
        CacheControl: options?.cacheControl ?? IMMUTABLE_CACHE_CONTROL,
      })
    )

    return {
      url: buildPublicUrl(pathname, config.publicBaseUrl),
      pathname,
      contentType: options?.contentType ?? null,
      provider: config.provider,
    }
  },

  async delete(pathname: string): Promise<void> {
    const config = resolveConfig()
    const client =
      config.provider === 's3'
        ? (cachedS3Client ??= buildClient(config))
        : (cachedR2Client ??= buildClient(config))
    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: pathname })
    )
  },

  async getUrl(pathname: string): Promise<string | null> {
    const config = resolveConfig()
    const client =
      config.provider === 's3'
        ? (cachedS3Client ??= buildClient(config))
        : (cachedR2Client ??= buildClient(config))
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: pathname })
      )
      return buildPublicUrl(pathname, config.publicBaseUrl)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  },

  async list(options?: ListOptions): Promise<ListResult> {
    const config = resolveConfig()
    const client =
      config.provider === 's3'
        ? (cachedS3Client ??= buildClient(config))
        : (cachedR2Client ??= buildClient(config))
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
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

export const createS3StorageAdapter = (): StorageAdapter =>
  createS3LikeStorageAdapter(s3ConfigFromEnv)

/** Deprecated alias kept for backward compatibility with R2_* configuration. */
export const createR2StorageAdapter = (): StorageAdapter =>
  createS3LikeStorageAdapter(r2ConfigFromEnv)

/** Exposed for tests that need to reset memoized clients between cases. */
export const __resetS3ClientsForTests = (): void => {
  cachedS3Client = null
  cachedR2Client = null
}
