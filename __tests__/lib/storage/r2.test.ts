import { describe, it, expect, vi } from 'vitest'

const { mockCreateR2StorageAdapter, mockResetS3ClientsForTests } = vi.hoisted(
  () => ({
    mockCreateR2StorageAdapter: vi.fn(() => ({ id: 'adapter' })),
    mockResetS3ClientsForTests: vi.fn(),
  })
)

vi.mock('@/lib/storage/s3', () => ({
  createR2StorageAdapter: mockCreateR2StorageAdapter,
  __resetS3ClientsForTests: mockResetS3ClientsForTests,
}))

import {
  createR2StorageAdapter,
  __resetR2ClientForTests,
} from '@/lib/storage/r2'

describe('storage/r2', () => {
  it('delegates adapter creation to the S3-compatible implementation', () => {
    const adapter = createR2StorageAdapter()

    expect(adapter).toEqual({ id: 'adapter' })
    expect(mockCreateR2StorageAdapter).toHaveBeenCalledTimes(1)
  })

  it('delegates client reset to the S3-compatible implementation', () => {
    __resetR2ClientForTests()

    expect(mockResetS3ClientsForTests).toHaveBeenCalledTimes(1)
  })
})
