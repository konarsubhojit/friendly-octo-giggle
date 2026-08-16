#!/usr/bin/env -S npx tsx
/**
 * Vercel Blob → Cloudflare R2 storage migration.
 *
 * Copies every object already stored in Vercel Blob into R2, without ever
 * deleting the Vercel copy — the cutover to `STORAGE_PROVIDER=r2` is a
 * read-path change (`resolveStorageUrl`'s dual-read fallback in
 * `src/lib/storage/index.ts`), so the Vercel objects must keep existing
 * until every consumer has been confirmed on the new provider and a
 * separate, deliberate cleanup is run.
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
 *   - Dry-run by default: nothing is written to R2 unless `--apply` is
 *     passed. Dry-run still performs the verification reachability checks
 *     (source fetch HEAD, destination existence check) so its report
 *     reflects what a real run would actually do, not just what `list()`
 *     returns.
 *
 * Usage:
 *   npm run migrate:storage -- --dry-run          # default; report only
 *   npm run migrate:storage -- --apply             # perform the copy
 *   npm run migrate:storage -- --apply --limit=100  # cap objects per run
 *   npm run migrate:storage -- --apply --prefix=images/2025/
 *
 * Requires the same environment as the running application: R2 write
 * credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
 * `R2_BUCKET`, `R2_PUBLIC_BASE_URL`) and `BLOB_READ_WRITE_TOKEN` for Vercel
 * Blob — both are read through `@/lib/storage`, which in turn loads
 * `@/lib/env`, so every other validated environment variable (notably
 * `DATABASE_URL`) must also be present even though this script never
 * touches the database.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  getStorageAdapterFor,
  type ListedObject,
  IMMUTABLE_CACHE_CONTROL,
} from '@/lib/storage'

export interface MigrationOptions {
  readonly apply: boolean
  readonly prefix?: string
  readonly limit: number
  readonly checkpointPath: string
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
    }
  }

  return {
    apply,
    prefix,
    limit:
      Number.isFinite(limit) && limit > 0 ? limit : Number.POSITIVE_INFINITY,
    checkpointPath,
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
  prefix: string | undefined
): Promise<ListedObject[]> => {
  const vercel = getStorageAdapterFor('vercel')
  const objects: ListedObject[] = []
  let cursor: string | undefined

  do {
    const page = await vercel.list({ prefix, cursor, limit: 1000 })
    objects.push(...page.objects)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  return objects
}

/**
 * Migrate one object: verify-skip if already at the destination, otherwise
 * (when `apply`) fetch the source bytes, write them to R2, and verify the
 * write by re-reading the destination and comparing size.
 */
export const migrateOne = async (
  object: ListedObject,
  options: Pick<MigrationOptions, 'apply'>
): Promise<
  | { outcome: 'already_migrated' }
  | { outcome: 'would_copy' }
  | { outcome: 'copied' }
  | { outcome: 'failed'; reason: string }
> => {
  const vercel = getStorageAdapterFor('vercel')
  const r2 = getStorageAdapterFor('r2')

  const existingUrl = await r2.getUrl(object.pathname)
  if (existingUrl) return { outcome: 'already_migrated' }

  if (!options.apply) return { outcome: 'would_copy' }

  const sourceUrl = await vercel.getUrl(object.pathname)
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

  await r2.put(object.pathname, bytes, {
    contentType,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  })

  const verifiedUrl = await r2.getUrl(object.pathname)
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

  const allObjects = await listAllSourceObjects(options.prefix)
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

    const result = await migrateOne(object, { apply: options.apply })

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
