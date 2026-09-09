/**
 * The `StorageAdapter` contract, exercised against a real S3-compatible
 * server.
 *
 * `contract.test.ts` proves every adapter *shape* is interchangeable against
 * a faked SDK; this suite proves the real `createS3StorageAdapter()` (the
 * adapter the self-hosted profile selects via `STORAGE_PROVIDER=s3`) works
 * against an actual S3-compatible endpoint — MinIO in the CI provider-matrix
 * job, but any S3-compatible server locally.
 *
 * It is opt-in — set `STORAGE_TEST_S3_ENDPOINT`, `STORAGE_TEST_S3_BUCKET`,
 * `STORAGE_TEST_S3_ACCESS_KEY_ID`, and `STORAGE_TEST_S3_SECRET_ACCESS_KEY` to
 * a disposable bucket (for example the `minio/minio` service the CI
 * provider-matrix job starts) and re-run `npm test`. Without those variables
 * the suite is skipped, so the default unit run stays hermetic.
 *
 * Deliberately distinct env var names from the production `S3_*` variables:
 * this suite writes and deletes real objects, and must never run against a
 * developer's real bucket just because they have production credentials in
 * their shell.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const TEST_ENDPOINT = process.env.STORAGE_TEST_S3_ENDPOINT
const TEST_BUCKET = process.env.STORAGE_TEST_S3_BUCKET
const TEST_ACCESS_KEY_ID = process.env.STORAGE_TEST_S3_ACCESS_KEY_ID
const TEST_SECRET_ACCESS_KEY = process.env.STORAGE_TEST_S3_SECRET_ACCESS_KEY

const CONFIGURED = Boolean(
  TEST_ENDPOINT && TEST_BUCKET && TEST_ACCESS_KEY_ID && TEST_SECRET_ACCESS_KEY
)

describe.skipIf(!CONFIGURED)(
  'createS3StorageAdapter() against a real S3-compatible server (MinIO)',
  () => {
    let adapter: import('@/lib/storage/types').StorageAdapter

    beforeAll(async () => {
      process.env.S3_REGION = process.env.STORAGE_TEST_S3_REGION ?? 'us-east-1'
      process.env.S3_BUCKET = TEST_BUCKET
      process.env.S3_ACCESS_KEY_ID = TEST_ACCESS_KEY_ID
      process.env.S3_SECRET_ACCESS_KEY = TEST_SECRET_ACCESS_KEY
      process.env.S3_PUBLIC_BASE_URL =
        process.env.STORAGE_TEST_S3_PUBLIC_BASE_URL ??
        `${TEST_ENDPOINT}/${TEST_BUCKET}`
      process.env.S3_ENDPOINT = TEST_ENDPOINT
      process.env.S3_FORCE_PATH_STYLE = 'true'

      const { createS3StorageAdapter } = await import('@/lib/storage/s3')
      adapter = createS3StorageAdapter()
    })

    afterEach(async () => {
      await adapter.delete('contract-test/object.txt')
      await adapter.delete('contract-test/list/a.txt')
      await adapter.delete('contract-test/list/b.txt')
    })

    it('reports provider name s3', () => {
      expect(adapter.provider).toBe('s3')
    })

    it('put() writes an object that getUrl() then resolves', async () => {
      await adapter.put(
        'contract-test/object.txt',
        Buffer.from('hello world'),
        { contentType: 'text/plain' }
      )

      await expect(
        adapter.getUrl('contract-test/object.txt')
      ).resolves.toEqual(expect.any(String))
    })

    it('getUrl() returns null for an object that was never written', async () => {
      await expect(
        adapter.getUrl('contract-test/never-written.txt')
      ).resolves.toBeNull()
    })

    it('delete() then getUrl() reports the object is gone', async () => {
      await adapter.put('contract-test/object.txt', Buffer.from('bye'))
      await adapter.delete('contract-test/object.txt')
      await expect(
        adapter.getUrl('contract-test/object.txt')
      ).resolves.toBeNull()
    })

    it('list() enumerates written objects under a prefix', async () => {
      await adapter.put('contract-test/list/a.txt', Buffer.from('a'))
      await adapter.put('contract-test/list/b.txt', Buffer.from('b'))

      const result = await adapter.list({ prefix: 'contract-test/list/' })
      expect(result.objects.map((o) => o.pathname)).toEqual(
        expect.arrayContaining([
          'contract-test/list/a.txt',
          'contract-test/list/b.txt',
        ])
      )
    })
  }
)
