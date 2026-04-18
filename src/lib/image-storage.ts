import { put } from '@vercel/blob'
import {
  BlobServiceClient,
  ContainerClient,
  type BlockBlobUploadOptions,
} from '@azure/storage-blob'
import { env } from '@/lib/env'

export type ImageStorageProvider = 'vercel' | 'azure'

export interface UploadImageOptions {
  readonly provider?: ImageStorageProvider
  readonly azureAccountAlias?: string | null
}

export interface UploadedImage {
  readonly url: string
  readonly pathname: string
  readonly contentType: string | null
  readonly provider: ImageStorageProvider
  readonly azureAccountAlias?: string
}

interface AzureBlobAccountConfig {
  readonly alias: string
  readonly connectionString: string
  readonly container: string
}

const DEFAULT_PROVIDER: ImageStorageProvider =
  env.IMAGE_UPLOAD_PROVIDER === 'azure' ? 'azure' : 'vercel'

const AZURE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

const normalizePathSegment = (segment: string): string =>
  segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const getFileExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf('.')
  if (index === -1) return ''
  const ext = fileName.slice(index)
  return /^[.][a-zA-Z0-9]+$/.test(ext) ? ext.toLowerCase() : ''
}

const buildBlobName = (fileName: string): string => {
  const ext = getFileExtension(fileName)
  return `images/${crypto.randomUUID()}${ext}`
}

const getAzureAccounts = (): AzureBlobAccountConfig[] => {
  if (!env.AZURE_BLOB_ACCOUNTS_JSON) {
    throw new Error(
      'Azure Blob upload is not configured. Set AZURE_BLOB_ACCOUNTS_JSON.'
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(env.AZURE_BLOB_ACCOUNTS_JSON)
  } catch {
    throw new Error('Invalid AZURE_BLOB_ACCOUNTS_JSON. Must be valid JSON.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AZURE_BLOB_ACCOUNTS_JSON must be a JSON array.')
  }

  return parsed.map((item, index) => {
    const raw = item as Partial<AzureBlobAccountConfig>
    if (!raw.alias || !raw.connectionString || !raw.container) {
      throw new Error(
        `AZURE_BLOB_ACCOUNTS_JSON[${index}] must include alias, connectionString, and container.`
      )
    }

    return {
      alias: normalizePathSegment(raw.alias),
      connectionString: raw.connectionString,
      container: raw.container,
    }
  })
}

const pickAzureAccount = (
  accounts: AzureBlobAccountConfig[],
  requestedAlias: string | null | undefined
): AzureBlobAccountConfig => {
  const alias = normalizePathSegment(
    requestedAlias ?? env.AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS ?? accounts[0]?.alias
  )

  const account = accounts.find((candidate) => candidate.alias === alias)
  if (!account) {
    throw new Error(`Azure Blob account alias "${alias}" is not configured.`)
  }
  return account
}

const getContainerClient = (account: AzureBlobAccountConfig): ContainerClient => {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    account.connectionString
  )
  return blobServiceClient.getContainerClient(account.container)
}

const ensureContainerIfRequested = async (
  containerClient: ContainerClient
): Promise<void> => {
  if (env.AZURE_BLOB_AUTO_CREATE_CONTAINER !== 'true') return
  await containerClient.createIfNotExists()
}

const uploadToAzureBlob = async (
  file: File,
  requestedAlias?: string | null
): Promise<UploadedImage> => {
  const accounts = getAzureAccounts()
  const account = pickAzureAccount(accounts, requestedAlias)
  const containerClient = getContainerClient(account)

  await ensureContainerIfRequested(containerClient)

  const blobName = buildBlobName(file.name)
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  const data = Buffer.from(await file.arrayBuffer())

  const uploadOptions: BlockBlobUploadOptions = {
    blobHTTPHeaders: {
      blobContentType: file.type || 'application/octet-stream',
      blobCacheControl: AZURE_CACHE_CONTROL,
    },
  }

  await blockBlobClient.uploadData(data, uploadOptions)

  return {
    url: blockBlobClient.url,
    pathname: blobName,
    contentType: file.type || null,
    provider: 'azure',
    azureAccountAlias: account.alias,
  }
}

const uploadToVercelBlob = async (file: File): Promise<UploadedImage> => {
  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true,
  })

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: blob.contentType,
    provider: 'vercel',
  }
}

export async function uploadImage(
  file: File,
  options: UploadImageOptions = {}
): Promise<UploadedImage> {
  const provider = options.provider ?? DEFAULT_PROVIDER

  if (provider === 'azure') {
    return uploadToAzureBlob(file, options.azureAccountAlias)
  }

  return uploadToVercelBlob(file)
}
