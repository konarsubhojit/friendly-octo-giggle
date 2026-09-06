# Feature Specification: Provider-Neutral Image Storage (R2 Migration)

**Feature Branch**: `025-provider-neutral-image-storage`
**Created**: 2026-08-16
**Status**: Implemented
**Epic**: Phase 1 — Foundation
**Input**: Replace the Azure Blob Storage upload option with Cloudflare R2 as an
S3-compatible provider, behind the same provider-neutral interface as Vercel
Blob, with a safe cutover path and edge image resizing.

## Baseline (verified 2026-08-16)

Azure Blob Storage was an unused second upload provider: `src/lib/image-storage.ts`
branched on an `azureAccountAlias` field that was never exercised in
production and required the `@azure/storage-blob` SDK as a dependency for a
path nobody used. Meanwhile there was no story for resizing images at the
edge, and `next/image` relied on Next's built-in optimizer against whichever
single blob origin was configured.

## What shipped

- **`src/lib/storage/` — provider-neutral adapter interface.** `StorageAdapter`
  defines `put`, `delete`, `getUrl`, and `list`. Two adapters implement it:
  `vercel.ts` (wraps `@vercel/blob`) and `r2.ts` (wraps
  `@aws-sdk/client-s3` against Cloudflare R2's S3-compatible endpoint).
  `STORAGE_PROVIDER` (`r2` | `vercel`, default `vercel`) selects which adapter
  is primary via `getStorageAdapterFor` / `getPrimaryStorageAdapter`.
- **Dual-read fallback.** `resolveStorageUrl` in `src/lib/storage/index.ts`
  tries the primary provider first and falls back to the other provider when
  an object is missing, emitting structured `storage_dual_read_fallback` /
  `storage_dual_read_miss` log events. This lets `STORAGE_PROVIDER` flip to
  `r2` before every historical object has been copied over.
- **`src/lib/image-storage.ts` retained.** `uploadImage()` keeps its existing
  signature and return shape (`url`, `pathname`, `contentType`) so callers
  (the upload route, admin UI) did not need to change; it now delegates to
  the resolved storage adapter instead of branching on Azure/Vercel.
- **Azure removed entirely.** `@azure/storage-blob` dropped from
  `package.json`; all Azure-specific fields, branches, and env keys removed
  from `src/lib/image-storage.ts`, `src/lib/validations/env.ts`, and
  `src/app/api/upload/route.ts`.
- **`scripts/migrate-storage-to-r2.ts` — backfill script.** Idempotent
  (already-migrated objects are skipped via `getUrl` on the destination,
  independent of its own checkpoint), resumable (checkpoint file after every
  object), and dry-run by default (`--apply` required to write). Verifies
  each copy by re-reading it from R2 before marking it migrated. Never
  deletes the Vercel source. Run via `npm run migrate:storage`.
- **`workers/images/` — Cloudflare Worker for edge resizing.** Validates the
  request (`workers/images/src/validation.ts`: hostname allow-list, width,
  quality, and format bounds) before fetching the origin image through
  Cloudflare's Image Resizing (`cf.image`), then serves it with an immutable
  `Cache-Control` and a `Vary: Accept` header. Deployed by
  `.github/workflows/deploy-images-worker.yml` on pushes to `develop` that
  touch `workers/images/**`.
- **`src/lib/image-loader.ts` — global `next/image` loader.** Points
  `next.config.ts`'s `images.loader: 'custom'` at the Worker
  (`NEXT_PUBLIC_IMAGE_WORKER_URL`), clamping width and quality before
  building the request URL, and falling back to the unmodified source URL
  when the Worker is not configured (so image rendering never depends on the
  Worker's existence).

## Requirements

- **FR-001**: The storage layer MUST expose a single `StorageAdapter`
  interface (`put`/`delete`/`getUrl`/`list`) implemented independently by a
  Vercel Blob adapter and a Cloudflare R2 adapter.
- **FR-002**: `STORAGE_PROVIDER` MUST select the primary adapter, defaulting
  to `vercel` when unset, and MUST reject any value other than `r2` or
  `vercel`.
- **FR-003**: Reads MUST fall back from the primary provider to the other
  provider when an object is missing, and MUST log the fallback and the
  double-miss case as structured events.
- **FR-004**: `uploadImage()` MUST keep its existing call signature and
  response shape so upload callers do not require changes beyond the
  provider selection itself.
- **FR-005**: No Azure SDK, Azure environment variables, or Azure-branching
  code MAY remain in the storage path.
- **FR-006**: The migration script MUST NOT delete or mutate the Vercel
  source objects, MUST be safely re-runnable (idempotent), and MUST default
  to a dry run that performs no writes.
- **FR-007**: The image-resizing Worker MUST reject requests for hostnames
  outside its allow-list and MUST clamp width, quality, and format to a
  fixed safe range before constructing the `cf.image` fetch.
- **FR-008**: The Worker's responses MUST carry an immutable `Cache-Control`
  header so CDN and browser caches do not need to revalidate per request.
- **FR-009**: The Next.js custom image loader MUST clamp width and quality to
  the same bounds as the Worker and MUST fall back to the original source URL
  when the Worker is not configured.

## Success Criteria

- **SC-001**: `STORAGE_PROVIDER=r2` and `STORAGE_PROVIDER=vercel` both upload,
  read, and delete objects correctly with no code path branching on a
  provider other than through the adapter interface.
- **SC-002**: Flipping `STORAGE_PROVIDER` from `vercel` to `r2` with no
  objects yet migrated does not break image rendering for existing products
  (dual-read fallback serves them from Vercel until migrated).
- **SC-003**: `npm run migrate:storage` (dry run) reports the objects it
  would copy without writing to R2; `npm run migrate:storage -- --apply`
  copies and verifies them, and re-running it afterward reports every
  object as already migrated.
- **SC-004**: A request to the Worker for a disallowed hostname, an
  out-of-range width/quality, or an unsupported format is rejected before any
  origin fetch occurs.
- **SC-005**: No reference to `@azure/storage-blob` or Azure Blob Storage
  remains in `package.json`, `src/`, `scripts/`, or the environment schema.
