import {
  __resetS3ClientsForTests,
  createR2StorageAdapter as createR2StorageAdapterFromS3,
} from './s3'
import type { StorageAdapter } from './types'

export const createR2StorageAdapter = (): StorageAdapter =>
  createR2StorageAdapterFromS3()

/** Kept for backward-compatible test imports. */
export const __resetR2ClientForTests = (): void => {
  __resetS3ClientsForTests()
}
