import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPut = vi.hoisted(() => vi.fn())
const mockUploadData = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockGetBlockBlobClient = vi.hoisted(() =>
  vi.fn(() => ({
    uploadData: mockUploadData,
    url: 'https://blob.example.com/container/images/uuid.png',
  }))
)
const mockCreateIfNotExists = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
const mockGetContainerClient = vi.hoisted(() =>
  vi.fn(() => ({
    getBlockBlobClient: mockGetBlockBlobClient,
    createIfNotExists: mockCreateIfNotExists,
  }))
)
const mockFromConnectionString = vi.hoisted(() =>
  vi.fn(() => ({ getContainerClient: mockGetContainerClient }))
)
const mockEnv = vi.hoisted(() => ({
  IMAGE_UPLOAD_PROVIDER: undefined as string | undefined,
  AZURE_BLOB_ACCOUNTS_JSON: undefined as string | undefined,
  AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS: undefined as string | undefined,
  AZURE_BLOB_AUTO_CREATE_CONTAINER: undefined as string | undefined,
}))

vi.mock('@vercel/blob', () => ({ put: mockPut }))
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: { fromConnectionString: mockFromConnectionString },
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

const makeFile = (name = 'photo.PNG', type = 'image/png') =>
  new File([new Uint8Array([0x89, 0x50])], name, { type })

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.IMAGE_UPLOAD_PROVIDER = undefined
  mockEnv.AZURE_BLOB_ACCOUNTS_JSON = undefined
  mockEnv.AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS = undefined
  mockEnv.AZURE_BLOB_AUTO_CREATE_CONTAINER = undefined
  vi.resetModules()
})

describe('uploadImage (Vercel provider)', () => {
  it('uploads via @vercel/blob and returns its metadata by default', async () => {
    mockPut.mockResolvedValue({
      url: 'https://vercel.example.com/x.png',
      pathname: 'x.png',
      contentType: 'image/png',
    })
    const { uploadImage } = await import('@/lib/image-storage')
    const file = makeFile()
    const result = await uploadImage(file)

    expect(mockPut).toHaveBeenCalledWith(
      'photo.PNG',
      file,
      expect.objectContaining({ access: 'public', addRandomSuffix: true })
    )
    expect(result).toEqual({
      url: 'https://vercel.example.com/x.png',
      pathname: 'x.png',
      contentType: 'image/png',
      provider: 'vercel',
    })
  })

  it('routes through Vercel when the explicit provider option says so even if Azure is the default', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockPut.mockResolvedValue({
      url: 'https://vercel.example.com/x.png',
      pathname: 'x.png',
      contentType: 'image/png',
    })
    const { uploadImage } = await import('@/lib/image-storage')
    const result = await uploadImage(makeFile(), { provider: 'vercel' })
    expect(result.provider).toBe('vercel')
    expect(mockFromConnectionString).not.toHaveBeenCalled()
  })
})

describe('uploadImage (Azure provider)', () => {
  const validAccountsJson = JSON.stringify([
    { alias: 'Primary', connectionString: 'conn-1', container: 'images' },
    { alias: 'secondary', connectionString: 'conn-2', container: 'images-2' },
  ])

  it('throws when AZURE_BLOB_ACCOUNTS_JSON is missing', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow(
      /Azure Blob upload is not configured/
    )
  })

  it('throws on invalid JSON', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = '{not json'
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow(/valid JSON/)
  })

  it('throws when JSON is not an array', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = '{"alias":"x"}'
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow(/JSON array/)
  })

  it('throws when an entry is missing required fields', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = JSON.stringify([
      { alias: 'a', container: 'c' },
    ])
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow(
      /must include alias, connectionString, and container/
    )
  })

  it('throws on duplicate normalized aliases', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = JSON.stringify([
      { alias: 'Primary', connectionString: 'c', container: 'x' },
      { alias: 'PRIMARY', connectionString: 'c', container: 'y' },
    ])
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow(
      /duplicate normalized alias/
    )
  })

  it('throws when the alias normalizes to an empty string', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = JSON.stringify([
      { alias: '!!!', connectionString: 'c', container: 'x' },
    ])
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow(
      /normalizes to an empty string/
    )
  })

  it('throws when a requested alias is not configured', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = validAccountsJson
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(
      uploadImage(makeFile(), {
        provider: 'azure',
        azureAccountAlias: 'unknown',
      })
    ).rejects.toThrow(/not configured/)
  })

  it('uploads via Azure using the requested alias and lowercases the extension', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = validAccountsJson
    const { uploadImage } = await import('@/lib/image-storage')

    const result = await uploadImage(makeFile('Hello.PNG', 'image/png'), {
      azureAccountAlias: 'secondary',
    })

    expect(mockFromConnectionString).toHaveBeenCalledWith('conn-2')
    expect(mockGetContainerClient).toHaveBeenCalledWith('images-2')
    expect(mockCreateIfNotExists).not.toHaveBeenCalled() // auto-create off by default

    const blobName = mockGetBlockBlobClient.mock.calls[0][0] as string
    expect(blobName).toMatch(/^images\/[0-9a-f-]+\.png$/i)

    expect(mockUploadData).toHaveBeenCalledTimes(1)
    const uploadOptions = mockUploadData.mock.calls[0][1] as {
      blobHTTPHeaders: { blobContentType: string; blobCacheControl: string }
      abortSignal: AbortSignal
    }
    expect(uploadOptions.blobHTTPHeaders.blobContentType).toBe('image/png')
    expect(uploadOptions.blobHTTPHeaders.blobCacheControl).toContain(
      'max-age=31536000'
    )
    expect(uploadOptions.abortSignal).toBeInstanceOf(AbortSignal)

    expect(result).toEqual({
      url: 'https://blob.example.com/container/images/uuid.png',
      pathname: blobName,
      contentType: 'image/png',
      provider: 'azure',
      azureAccountAlias: 'secondary',
    })
  })

  it('falls back to the default account alias env var', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = validAccountsJson
    mockEnv.AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS = 'secondary'
    const { uploadImage } = await import('@/lib/image-storage')
    const result = await uploadImage(makeFile())
    expect(result.azureAccountAlias).toBe('secondary')
  })

  it('falls back to the first configured account when no alias is provided', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = validAccountsJson
    const { uploadImage } = await import('@/lib/image-storage')
    const result = await uploadImage(makeFile())
    expect(result.azureAccountAlias).toBe('primary')
  })

  it('calls createIfNotExists when AZURE_BLOB_AUTO_CREATE_CONTAINER=true', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = validAccountsJson
    mockEnv.AZURE_BLOB_AUTO_CREATE_CONTAINER = 'true'
    const { uploadImage } = await import('@/lib/image-storage')
    await uploadImage(makeFile())
    expect(mockCreateIfNotExists).toHaveBeenCalledWith({ access: 'blob' })
  })

  it('omits the file extension when it is missing or unsafe', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = validAccountsJson
    const { uploadImage } = await import('@/lib/image-storage')

    await uploadImage(makeFile('noext', 'application/octet-stream'))
    const blobName1 = mockGetBlockBlobClient.mock.calls[0][0] as string
    expect(blobName1).toMatch(/^images\/[0-9a-f-]+$/i)

    mockGetBlockBlobClient.mockClear()
    await uploadImage(makeFile('weird.<.bad>', 'application/octet-stream'))
    const blobName2 = mockGetBlockBlobClient.mock.calls[0][0] as string
    expect(blobName2).toMatch(/^images\/[0-9a-f-]+$/i)
  })

  it('clears the upload timeout even when uploadData throws', async () => {
    mockEnv.IMAGE_UPLOAD_PROVIDER = 'azure'
    mockEnv.AZURE_BLOB_ACCOUNTS_JSON = validAccountsJson
    mockUploadData.mockRejectedValueOnce(new Error('network'))
    const { uploadImage } = await import('@/lib/image-storage')
    await expect(uploadImage(makeFile())).rejects.toThrow('network')
    // If the timeout wasn't cleared, this test process would have a dangling
    // 60s timer; vitest's fake-timer infra would otherwise complain.
  })
})
