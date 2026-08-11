# Phase 1 Data Model: Admin Console Revamp

This document covers only entities this feature adds or extends. All other
existing tables (`orders`, `products`, `users`, `returns`, `reviews`,
`coupons`, etc.) are read and mutated exactly as today; their business logic
and schema are unchanged (Out of Scope).

## 1. Admin activity record (extends existing `AdminAuditLog`)

Already exists in `src/lib/schema.ts` (`adminAuditLogs`, table name
`AdminAuditLog`). This feature makes it complete and readable; it does not
redesign it.

**Existing columns** (unchanged):

| Column      | Type                              | Notes                                                    |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `id`        | `varchar(7)`, PK                  | Short ID via `generateShortId()`                          |
| `userId`    | `text`, FK → `users.id`, cascade  | Acting user                                                |
| `role`      | `userRoleEnum`, nullable          | Actor's role at time of action (FR-D02)                    |
| `entity`    | `text`, not null                  | Entity type (`order`, `product`, `user`, …)                |
| `entityId`  | `text`, not null                  | Entity identifier                                          |
| `action`    | `text`, not null                  | Action performed (e.g. `refund`, `status_change`)          |
| `diff`      | `json`, not null, default `{}`    | Structured before/after change set (FR-D02/D03)            |
| `createdAt` | `timestamp`, default now, not null | Time of action                                             |

**Existing indexes** (unchanged): `userId`, `entity`, `createdAt`.

**Additive changes required by this feature:**

| Change                                                    | Requirement    | Rationale                                                                                                   |
| ---------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| Composite index on `(entity, entityId, createdAt)`         | FR-D06, NFR-007 | Per-entity activity panels query `entity = X AND entityId = Y ORDER BY createdAt DESC` — the existing single-column `entity` index does not support this efficiently at 24-month volume. |
| Composite index on `(action, createdAt)`                   | FR-D05         | Global-view filtering by action type combined with date range.                                              |
| Nullable `actorName` / `actorEmail` denormalised columns *(optional, decide during implementation)* | FR-D02 ("acting person's identity") | Avoids an extra join to `users` per row when a user is later deleted or renamed; the spec's Baseline note ("nullable columns to support … denormalised actor display") anticipates this. If the join proves cheap enough (single query with `users` join, indexed FK), this may be unnecessary — decide against actual query-cost measurement rather than pre-emptively adding columns (Principle VII). |

No column is removed, renamed, or made non-nullable. `diff` retains its
existing shape; FR-D11 (no credentials/payment data in the diff) is enforced
at the call sites that construct the diff, not by a schema change.

**Validation rules:**

- `diff` MUST NOT contain keys matching a documented denylist (password
  hashes, tokens, card/payment instrument fields) — enforced by a shared
  serialization helper used by every call site that builds a diff, not
  re-implemented per call site (Constitution Principle VIII).
- Every mutating admin API route MUST call the audit-write helper exactly
  once per logical mutation; this is asserted by the automated coverage
  check (SC-005), not by a database constraint.

**Lifecycle / retention:**

- Rows older than 24 months from `createdAt` are hard-deleted by the
  scheduled Inngest retention function (FR-D12/D13). This is the only
  permitted deletion path; no admin surface may delete a row (FR-D08).
- On the referenced entity's deletion, the activity row is retained
  unchanged (FR-D07) — `entityId` is a plain `text` column with no FK
  constraint to any specific entity table, so it survives entity deletion
  by construction; no cascading delete rule needs to change.

## 2. Saved view (new table)

**Table**: `AdminSavedView` (Drizzle export name `adminSavedViews`)

| Column               | Type                                   | Notes                                                                                       |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                  | `varchar(7)`, PK, `generateShortId()`  | Consistent with the project's ID convention                                                      |
| `ownerId`             | `text`, FK → `users.id`, cascade, nullable | Null denotes a built-in/shared view (FR-A20); non-null denotes a private, owner-scoped view (FR-A18) |
| `resource`            | `text`, not null                       | Which resource this view applies to (`orders`, `products`, `returns`, …)                         |
| `name`                | `text`, not null                       | User- or product-supplied label                                                                  |
| `criteria`            | `json`, not null                       | `{ search?: string, filters?: Record<string, unknown>, sort?: { field: string, direction: 'asc'|'desc' } }` |
| `isBuiltIn`           | `boolean`, not null, default `false`   | True only for shipped, read-only defaults (FR-A20)                                               |
| `requiredPermission`  | `text` (or the `AdminPermission` enum), nullable | Only set on built-in views; gates visibility (FR-A20)                                            |
| `createdAt`           | `timestamp`, default now, not null     |                                                                                                    |
| `updatedAt`           | `timestamp`, default now, not null, on update now |                                                                                         |

**Indexes**: `(ownerId, resource)` for "my saved views for this resource";
`(resource, isBuiltIn)` for "built-in views for this resource."

**Validation rules:**

- A row with `ownerId IS NULL` MUST have `isBuiltIn = true`; a row with
  `ownerId IS NOT NULL` MUST have `isBuiltIn = false`. Enforced at the
  application layer (Zod-validated write path) since Drizzle/Postgres CHECK
  constraints would need a raw-SQL migration statement for a boolean/nullable
  cross-column rule — acceptable inside a Drizzle-generated migration per the
  constitution's raw-SQL exception for migrations, but the simpler and
  sufficient control here is an application-level invariant enforced by the
  single write path (Principle VIII: one code path, not duplicated checks).
- `criteria` MUST validate against a Zod schema shared with the resource's
  list-definition filter shape, so a saved view can never encode a filter
  the resource doesn't support.
- Query access MUST always be scoped as `WHERE (ownerId = :currentUserId) OR
  (isBuiltIn = true AND :currentUserPermissions INCLUDES requiredPermission)`
  — never a broader query filtered client-side, since FR-A18 requires zero
  cross-user visibility and SC-018 requires this verified per role pairing.

**State transitions**: none beyond create / rename / delete-by-owner for
private views. Built-in views are seeded, not created or deleted through the
API (no DELETE/PATCH endpoint accepts `isBuiltIn = true` targets).

## 3. Resource list definition (in-code configuration, not a database table)

Not persisted — this is the declarative shape each admin resource screen
supplies to the extended `AdminDataView`, satisfying FR-A02/FR-A15/FR-A15a.
Expressed as a typed object per resource, e.g.
`src/features/admin/resources/orders.ts`, `products.ts`, etc.

```text
interface ResourceListDefinition<T> {
  resource: string                       // matches AdminSavedView.resource
  columns: DataTableColumn<T>[]          // zenput DataTable columns
  filters: FilterDefinition[]            // available filter controls
  sortOptions?: SortOption[]
  searchable: boolean                    // FR-A03
  rowActions: (row: T, perms: AdminPermission[]) => RowAction[]   // FR-A14
  bulkActions: (perms: AdminPermission[]) => BulkAction[]         // FR-A09
  exportable: boolean                    // FR-A12
  emptyMessage: string
  filteredEmptyMessage: string           // FR-A11 distinct empty-vs-filtered-empty
}
```

This is a type-level/data-shape addition to `src/features/admin/components/`
or a new `src/features/admin/resources/` module, not a schema or migration
change.

## 4. Bulk operation (transient; not fully persisted unless it exceeds the
   synchronous ceiling)

For selections within the documented synchronous ceiling (see research.md §6),
a bulk operation is a request/response pair against the existing
`orders/bulk` / `products/bulk` endpoints — no new persisted state.

For selections that exceed the ceiling or apply to the entire filtered
result set (FR-A16), a bulk operation becomes a tracked background job. Its
status needs a minimal persisted or Redis-backed record for polling:

| Field           | Notes                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| `id`             | Job identifier (Inngest run ID or a generated short ID)                |
| `resource`       | e.g. `orders`                                                            |
| `action`         | e.g. `mark_shipped`                                                      |
| `initiatedBy`    | User ID                                                                  |
| `selectionScope` | `'loaded_page' \| 'entire_filtered_result'` (FR-A16)                     |
| `total`          | Row count targeted                                                       |
| `succeeded`      | Count so far                                                            |
| `failed`         | Array of `{ rowId, reason }` (FR-A10)                                    |
| `status`         | `'running' \| 'completed' \| 'completed_with_errors' \| 'failed'`        |

Whether this is a new lightweight table or a Redis-backed structure is an
implementation detail decided during task planning against actual selection
volumes; either choice is additive and does not touch existing bulk-endpoint
contracts (spec Assumption: "no new bulk capability is introduced beyond
exposing what already exists").

## 5. Actionable queue (in-code configuration, not a database table)

Each dashboard queue (FR-G02) is a `{ resource, filter, permission }` tuple
evaluated against existing resources — e.g. "orders awaiting fulfilment" is
`resource: 'orders', filter: { status: 'awaiting_fulfilment' }, permission:
'orders:read'`. No new entity is stored; each queue's count is a `COUNT(*)`
query against the existing resource table using its existing filter
semantics, fetched independently per FR-G06 (isolated failure).

## Entity relationship summary

```text
users (existing) ──1:N── AdminAuditLog (existing, extended: new indexes)
users (existing) ──1:N── AdminSavedView (new; ownerId nullable for built-ins)
AdminSavedView.resource ──config──> ResourceListDefinition (in-code, not FK)
ResourceListDefinition ──drives──> AdminDataView (extended component)
Actionable queue (in-code) ──reads──> existing resource tables (orders, products, reviews, ...)
Bulk operation (transient or new minimal job-status record) ──targets──> existing resource tables
```

No existing table's relationships change. Both new/extended structures are
additive per the spec's Out of Scope constraint.
