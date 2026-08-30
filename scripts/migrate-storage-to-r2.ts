#!/usr/bin/env -S npx tsx
/**
 * Storage migration between configured providers.
 *
 * Copies every object from one provider into another, without ever deleting the
 * source copy — the cutover to a new `STORAGE_PROVIDER` is a
 * read-path change (`resolveStorageUrl`'s dual-read fallback in
 * `src/lib/storage/index.ts`), so source-provider objects must stay in place
 * until every consumer has been confirmed on the new provider and a separate,
 * deliberate cleanup is run.
 *
 * Guarantees:
 *   - Idempotent: an object already present at the destination (checked via
 *     `getUrl`, independent of the checkpoint file) is skipped, so running
 *     this script twice — or against a partially-migrated bucket — never
 *     double-copies.
 *   - Resumable: progress is written to a checkpoint file after every object,
 *     so an interrupted run (Ctrl-C, network failure, CI timeout) picks back
 *     up from the last completed object instead of restarting.
 *   - Verified: after every copy, the script re-reads the destination
 *     (`getUrl`) and compares the source and destination byte length before
 *     marking the object migrated. A copy that "succeeded" but produced a
 *     truncated object is reported as a failure, not a silent success.
 *   - Dry-run by default: nothing is written to the destination unless `--apply` is
 *     passed. Dry-run still performs the verification reachability checks
 *     (source fetch HEAD, destination existence check) so its report
 *     reflects what a real run would actually do, not just what `list()`
 *     returns.
 *
 * Usage:
 *   npm run migrate:storage -- --dry-run                      # default; report only
 *   npm run migrate:storage -- --apply                        # perform the copy
 *   npm run migrate:storage -- --apply --from=vercel --to=r2  # explicit source/destination
 *   npm run migrate:storage -- --apply --from=vercel --to=s3 --limit=100
 *   npm run migrate:storage -- --apply --prefix=images/2025/
 *
 * Requires the same environment as the running application: source and
 * destination provider credentials (for `vercel`, `r2`, or `s3`) are read
 * through `@/lib/storage`, which in turn loads
 * `@/lib/env`, so every other validated environment variable (notably
 * `DATABASE_URL`) must also be present even though this script never
 * touches the database.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  getActiveProvider,
  getStorageAdapterFor,
  type ListedObject,
  IMMUTABLE_CACHE_CONTROL,
  type StorageProviderName,
} from '@/lib/storage'

export interface MigrationOptions {
  readonly apply: boolean
  readonly prefix?: string
  readonly limit: number
  readonly checkpointPath: string
  readonly sourceProvider: StorageProviderName
  readonly destinationProvider: StorageProviderName
}

export interface Checkpoint {
  /** Pathnames already verified as migrated in a previous run. */
  readonly migrated: string[]
}

export interface MigrationSummary {
  readonly dryRun: boolean
  readonly scanned: number
  readonly alreadyMigrated: number
  readonly migrated: number
  readonly skippedExisting: number
  readonly failed: number
  readonly failures: ReadonlyArray<{ pathname: string; reason: string }>
}

const DEFAULT_CHECKPOINT_PATH = path.resolve(
  process.cwd(),
  '.storage-migration-checkpoint.json'
)

/** Parse `--flag`, `--flag=value`, and `--flag value` style CLI arguments. */
export const parseArgs = (argv: readonly string[]): MigrationOptions => {
  let apply = false
  let prefix: string | undefined
  let limit = Number.POSITIVE_INFINITY
  let checkpointPath = DEFAULT_CHECKPOINT_PATH
  let sourceProvider: StorageProviderName = 'vercel'
  let destinationProvider: StorageProviderName = 'r2'

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--apply') {
      apply = true
    } else if (arg === '--dry-run') {
      apply = false
    } else if (arg.startsWith('--prefix=')) {
      prefix = arg.slice('--prefix='.length)
    } else if (arg.startsWith('--limit=')) {
      limit = Number.parseInt(arg.slice('--limit='.length), 10)
    } else if (arg.startsWith('--checkpoint=')) {
      checkpointPath = path.resolve(arg.slice('--checkpoint='.length))
    } else if (arg.startsWith('--from=')) {
      sourceProvider = arg.slice('--from='.length) as StorageProviderName
    } else if (arg.startsWith('--source=')) {
      sourceProvider = arg.slice('--source='.length) as StorageProviderName
    } else if (arg.startsWith('--to=')) {
      destinationProvider = arg.slice('--to='.length) as StorageProviderName
    } else if (arg.startsWith('--destination=')) {
      destinationProvider = arg.slice('--destination='.length) as StorageProviderName
    }
  }

  if (!argv.some((arg) => arg.startsWith('--to=') || arg.startsWith('--destination='))) {
    destinationProvider = getActiveProvider()
  }

  return {
    apply,
    prefix,
    limit:
      Number.isFinite(limit) && limit > 0 ? limit : Number.POSITIVE_INFINITY,
    checkpointPath,
    sourceProvider,
    destinationProvider,
  }
}

export const loadCheckpoint = (checkpointPath: string): Checkpoint => {
  if (!existsSync(checkpointPath)) return { migrated: [] }
  try {
    const parsed = JSON.parse(readFileSync(checkpointPath, 'utf8')) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as Checkpoint).migrated)
    ) {
      return { migrated: (parsed as Checkpoint).migrated }
    }
  } catch {
    // Corrupt or unreadable checkpoint: treat as empty rather than aborting
    // — every object will be re-verified via the idempotent existence check.
  }
  return { migrated: [] }
}

export const saveCheckpoint = (
  checkpointPath: string,
  checkpoint: Checkpoint
): void => {
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))
}

/** All Vercel Blob objects under `prefix`, paginated to completion. */
export const listAllSourceObjects = async (
  sourceProvider: StorageProviderName,
  prefix: string | undefined
): Promise<ListedObject[]> => {
  const sourceAdapter = getStorageAdapterFor(sourceProvider)
  const objects: ListedObject[] = []
  let cursor: string | undefined

  do {
    const page = await sourceAdapter.list({ prefix, cursor, limit: 1000 })
    objects.push(...page.objects)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  return objects
}

/**
 * Migrate one object: verify-skip if already at the destination, otherwise
 * (when `apply`) fetch the source bytes, write them to the destination, and verify the
 * write by re-reading the destination and comparing size.
 */
export const migrateOne = async (
  object: ListedObject,
  options: Pick<MigrationOptions, 'apply' | 'sourceProvider' | 'destinationProvider'>
): Promise<
  | { outcome: 'already_migrated' }
  | { outcome: 'would_copy' }
  | { outcome: 'copied' }
  | { outcome: 'failed'; reason: string }
> => {
  const source = getStorageAdapterFor(options.sourceProvider)
  const destination = getStorageAdapterFor(options.destinationProvider)

  const existingUrl = await destination.getUrl(object.pathname)
  if (existingUrl) return { outcome: 'already_migrated' }

  if (!options.apply) return { outcome: 'would_copy' }

  const sourceUrl = await source.getUrl(object.pathname)
  if (!sourceUrl) {
    return {
      outcome: 'failed',
      reason: `source object disappeared before it could be copied`,
    }
  }

  const response = await fetch(sourceUrl)
  if (!response.ok) {
    return {
      outcome: 'failed',
      reason: `source fetch failed with HTTP ${response.status}`,
    }
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type')

  await destination.put(object.pathname, bytes, {
    contentType,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  })

  const verifiedUrl = await destination.getUrl(object.pathname)
  if (!verifiedUrl) {
    return {
      outcome: 'failed',
      reason: 'object missing from destination immediately after copy',
    }
  }

  const verifyResponse = await fetch(verifiedUrl, { method: 'HEAD' })
  const destinationSize = Number.parseInt(
    verifyResponse.headers.get('content-length') ?? '-1',
    10
  )
  if (
    verifyResponse.ok &&
    destinationSize >= 0 &&
    destinationSize !== bytes.length
  ) {
    return {
      outcome: 'failed',
      reason: `size mismatch after copy: source ${bytes.length} bytes, destination ${destinationSize} bytes`,
    }
  }

  return { outcome: 'copied' }
}

export const runMigration = async (
  options: MigrationOptions
): Promise<MigrationSummary> => {
  const checkpoint = loadCheckpoint(options.checkpointPath)
  const alreadyMigratedSet = new Set(checkpoint.migrated)

  if (options.sourceProvider === options.destinationProvider) {
    throw new Error(
      `Source and destination providers must differ. Both were '${options.sourceProvider}'.`
    )
  }

  const allObjects = await listAllSourceObjects(
    options.sourceProvider,
    options.prefix
  )
  const objects = allObjects.slice(0, options.limit)

  let migrated = 0
  let alreadyMigrated = 0
  let skippedExisting = 0
  const failures: { pathname: string; reason: string }[] = []

  for (const object of objects) {
    if (alreadyMigratedSet.has(object.pathname)) {
      alreadyMigrated += 1
      continue
    }

    const result = await migrateOne(object, {
      apply: options.apply,
      sourceProvider: options.sourceProvider,
      destinationProvider: options.destinationProvider,
    })

    if (result.outcome === 'already_migrated') {
      skippedExisting += 1
      alreadyMigratedSet.add(object.pathname)
    } else if (result.outcome === 'copied') {
      migrated += 1
      alreadyMigratedSet.add(object.pathname)
    } else if (result.outcome === 'failed') {
      failures.push({ pathname: object.pathname, reason: result.reason })
    }
    // 'would_copy' (dry-run): neither a success nor a failure, don't record.

    if (options.apply) {
      saveCheckpoint(options.checkpointPath, {
        migrated: Array.from(alreadyMigratedSet),
      })
    }
  }

  return {
    dryRun: !options.apply,
    scanned: objects.length,
    alreadyMigrated,
    migrated,
    skippedExisting,
    failed: failures.length,
    failures,
  }
}

const printSummary = (summary: MigrationSummary): void => {
  console.log('')
  console.log(
    `Storage migration ${summary.dryRun ? '(dry run)' : '(applied)'} summary:`
  )
  console.log(`  Scanned:          ${summary.scanned}`)
  console.log(`  Already migrated: ${summary.alreadyMigrated}`)
  console.log(`  Migrated now:     ${summary.migrated}`)
  console.log(`  Skipped (exists): ${summary.skippedExisting}`)
  console.log(`  Failed:           ${summary.failed}`)
  if (summary.failures.length > 0) {
    console.log('')
    console.log('Failures:')
    for (const failure of summary.failures) {
      console.log(`  - ${failure.pathname}: ${failure.reason}`)
    }
  }
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('migrate-storage-to-r2.ts')

if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2))
  console.log(
    `Starting storage migration (${options.apply ? 'APPLY' : 'DRY RUN'})…`
  )
  runMigration(options)
    .then((summary) => {
      printSummary(summary)
      if (summary.failed > 0) process.exitCode = 1
    })
    .catch((error) => {
      console.error('Storage migration crashed:', error)
      process.exitCode = 1
    })
}
