/**
 * Shared behavioral contract for every `StorageAdapter`.
 *
 * `createVercelStorageAdapter`, `createS3StorageAdapter`, and
 * `createR2StorageAdapter` each wrap a different vendor SDK, but all three
 * are backed here by an in-memory fake standing in for the vendor, so the
 * same assertions run against every backend without live network I/O. This
 * is what "provider-neutral" means in practice: swapping `STORAGE_PROVIDER`
 * must never change what a consumer of `StorageAdapter` observes.
 *
 * The S3 fake also stands in for MinIO — S3 and MinIO speak the same wire
 * protocol, which is exactly why the S3 adapter is the one selected for the
 * self-hosted profile (`STORAGE_PROVIDER=s3` pointed at a MinIO endpoint).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageAdapter } from '@/lib/storage/types'

// ── Fake Vercel Blob SDK ─────────────────────────────────────────────────

const {
  vercelStore,
  mockVercelPut,
  mockVercelDel,
  mockVercelHead,
  mockVercelList,
  MockBlobNotFoundError,
} = vi.hoisted(() => {
  class MockBlobNotFoundError extends Error {}

  const vercelStore = new Map<string, { contentType: string | null }>()

  const mockVercelPut = vi.fn(
    async (
      pathname: string,
      _body: unknown,
      options?: { contentType?: string }
    ) => {
      vercelStore.set(pathname, {
        contentType: options?.contentType ?? null,
      })
      return {
        url: `https://blob.vercel-storage.com/${pathname}`,
        pathname,
        contentType: options?.contentType ?? null,
      }
    }
  )
  const mockVercelDel = vi.fn(async (pathname: string) => {
    vercelStore.delete(pathname)
  })
  const mockVercelHead = vi.fn(async (pathname: string) => {
    if (!vercelStore.has(pathname)) throw new MockBlobNotFoundError()
    return { url: `https://blob.vercel-storage.com/${pathname}` }
  })
  const mockVercelList = vi.fn(
    async (options?: { prefix?: string; limit?: number; cursor?: string }) => {
      const blobs = [...vercelStore.keys()]
        .filter((key) => !options?.prefix || key.startsWith(options.prefix))
        .map((pathname) => ({
          pathname,
          size: 0,
          uploadedAt: new Date(),
        }))
      return { blobs, cursor: undefined, hasMore: false }
    }
  )

  return {
    vercelStore,
    mockVercelPut,
    mockVercelDel,
    mockVercelHead,
    mockVercelList,
    MockBlobNotFoundError,
  }
})

vi.mock('@vercel/blob', () => ({
  put: mockVercelPut,
  del: mockVercelDel,
  head: mockVercelHead,
  list: mockVercelList,
  BlobNotFoundError: MockBlobNotFoundError,
}))

// ── Fake S3-compatible SDK (also stands in for MinIO) ───────────────────

const { s3Store, mockSend } = vi.hoisted(() => {
  const s3Store = new Map<string, { contentType: string | null }>()

  const mockSend = vi.fn(
    async (command: { __type: string; input: Record<string, unknown> }) => {
      const bucket = String(command.input.Bucket)
      const key =
        command.input.Key !== undefined ? String(command.input.Key) : ''
      const storeKey = `${bucket}:${key}`

      switch (command.__type) {
        case 'Put': {
          const contentType =
            (command.input.ContentType as string | undefined) ?? null
          s3Store.set(storeKey, { contentType })
          return {}
        }
        case 'Delete': {
          s3Store.delete(storeKey)
          return {}
        }
        case 'Head': {
          if (!s3Store.has(storeKey)) {
            const error = new Error('NotFound')
            error.name = 'NotFound'
            throw error
          }
          return {}
        }
        case 'List': {
          const prefix = (command.input.Prefix as string | undefined) ?? ''
          const contents = [...s3Store.keys()]
            .filter((k) => k.startsWith(`${bucket}:`))
            .map((k) => k.slice(bucket.length + 1))
            .filter((k) => k.startsWith(prefix))
            .map((k) => ({ Key: k, Size: 0, LastModified: new Date() }))
          return { Contents: contents, IsTruncated: false }
        }
        default:
          throw new Error(`Unhandled fake S3 command: ${command.__type}`)
      }
    }
  )

  return { s3Store, mockSend }
})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function MockS3Client() {
    return { send: mockSend }
  }),
  PutObjectCommand: vi.fn(function MockPutObjectCommand(input: unknown) {
    return { input, __type: 'Put' }
  }),
  DeleteObjectCommand: vi.fn(function MockDeleteObjectCommand(input: unknown) {
    return { input, __type: 'Delete' }
  }),
  HeadObjectCommand: vi.fn(function MockHeadObjectCommand(input: unknown) {
    return { input, __type: 'Head' }
  }),
  ListObjectsV2Command: vi.fn(function MockListObjectsV2Command(
    input: unknown
  ) {
    return { input, __type: 'List' }
  }),
}))

vi.mock('@smithy/node-http-handler', () => ({
  NodeHttpHandler: vi.fn(),
}))

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: 'development',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'test-bucket',
  S3_ACCESS_KEY_ID: 'test-key-id',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_FORCE_PATH_STYLE: 'true',
  S3_CA_CERT_PEM: undefined as string | undefined,
  R2_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'r2-key-id',
  R2_SECRET_ACCESS_KEY: 'r2-secret',
  R2_BUCKET: 'r2-bucket',
  R2_PUBLIC_BASE_URL: 'https://r2.example.com',
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))

import { createVercelStorageAdapter } from '@/lib/storage/vercel'
import {
  createS3StorageAdapter,
  createR2StorageAdapter,
  __resetS3ClientsForTests,
} from '@/lib/storage/s3'

const buildAdapters = (): Array<{ name: string; adapter: StorageAdapter }> => {
  __resetS3ClientsForTests()
  return [
    { name: 'vercel', adapter: createVercelStorageAdapter() },
    {
      name: 's3 (also covers self-hosted MinIO)',
      adapter: createS3StorageAdapter(),
    },
    { name: 'r2', adapter: createR2StorageAdapter() },
  ]
}

describe('StorageAdapter contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vercelStore.clear()
    s3Store.clear()
  })

  it('every adapter reports its own provider name', () => {
    const adapters = buildAdapters()
    expect(adapters.map((a) => a.adapter.provider)).toEqual([
      'vercel',
      's3',
      'r2',
    ])
  })

  it.each(buildAdapters())(
    '$name: put() then getUrl() resolves a public URL',
    async ({ adapter }) => {
      const result = await adapter.put(
        'images/contract-test.png',
        Buffer.from([1, 2, 3]),
        { contentType: 'image/png' }
      )
      expect(result.pathname).toBe('images/contract-test.png')
      expect(result.provider).toBe(adapter.provider)
      expect(typeof result.url).toBe('string')

      await expect(adapter.getUrl('images/contract-test.png')).resolves.toEqual(
        expect.any(String)
      )
    }
  )

  it.each(buildAdapters())(
    '$name: getUrl() returns null for an object that was never written',
    async ({ adapter }) => {
      await expect(
        adapter.getUrl('images/never-written.png')
      ).resolves.toBeNull()
    }
  )

  it.each(buildAdapters())(
    '$name: delete() then getUrl() reports the object is gone',
    async ({ adapter }) => {
      await adapter.put('images/to-delete.png', Buffer.from([1]))
      await adapter.delete('images/to-delete.png')
      await expect(adapter.getUrl('images/to-delete.png')).resolves.toBeNull()
    }
  )

  it.each(buildAdapters())(
    '$name: delete() of a missing object does not throw',
    async ({ adapter }) => {
      await expect(
        adapter.delete('images/was-never-there.png')
      ).resolves.toBeUndefined()
    }
  )

  it.each(buildAdapters())(
    '$name: list() enumerates written objects under a prefix',
    async ({ adapter }) => {
      await adapter.put('images/list-test/a.png', Buffer.from([1]))
      await adapter.put('images/list-test/b.png', Buffer.from([2]))

      const result = await adapter.list({ prefix: 'images/list-test/' })
      expect(result.objects.length).toBeGreaterThanOrEqual(2)
      expect(result.objects.map((o) => o.pathname)).toEqual(
        expect.arrayContaining([
          'images/list-test/a.png',
          'images/list-test/b.png',
        ])
      )
      expect(typeof result.hasMore).toBe('boolean')
    }
  )
})
