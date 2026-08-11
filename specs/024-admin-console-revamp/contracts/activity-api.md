# Contract: Activity API

New route: `src/app/api/admin/activity/route.ts`. Read-only. Serves both the
global activity view (FR-D04/D05) and per-entity activity panels (FR-D06) via
query parameters, to avoid two parallel endpoints for one underlying query
shape (Principle VIII).

## Authorization

- `GET` requires the viewer to hold the permission gating the activity
  surface — reusing `system:manage` per the spec's Assumptions ("this
  feature adds no new permission … reuses an existing permission where one
  fits — `system:manage` being the closest fit") for the *global* view.
- When `entity` + `entityId` query params are present (per-entity panel
  mode), the required permission is the read permission for that entity
  type instead (e.g. `orders:read` for `entity=order`), matching FR-D09
  ("results MUST be restricted to entity types the viewer is permitted to
  read") and the acceptance scenario that an order/product/user detail
  screen's activity panel is visible to whoever can already read that
  entity.
- Enforced via `checkAdminAuth(permission)` exactly like every other admin
  route — no new authorization mechanism.

## Request

```text
GET /api/admin/activity
  ?entity=order|product|user|...       (optional — omit for global view)
  &entityId=<id>                        (required if entity is present)
  &action=<action-key>                  (optional filter, global view)
  &actorId=<userId>                     (optional filter, global view)
  &dateFrom=<ISO date>                  (optional filter)
  &dateTo=<ISO date>                    (optional filter)
  &cursor=<opaque cursor>               (optional, for pagination)
  &limit=<n>                            (optional, default page size)
```

Validated by a Zod schema in `src/lib/validations/admin.ts` (or an
`admin-activity.ts` sibling); invalid combinations (e.g. `entityId` without
`entity`) return `400` via `apiError`/`handleApiError`.

## Response

```ts
interface ActivityApiResponse {
  entries: ReadonlyArray<{
    id: string
    entity: string
    entityId: string
    action: string
    actor: { userId: string; role: string | null } // role at time of action
    changes: ReadonlyArray<{ field: string; before: unknown; after: unknown }>
    createdAt: string // ISO timestamp
  }>
  nextCursor: string | null
  retentionWindowMonths: 24 // FR-D14 — makes the window explicit to the viewer
}
```

- `changes` is derived from the existing `diff` JSON column, normalised into
  the one consistent shape FR-D03 requires, regardless of entity type.
- When `entity` type filtering excludes some records from the viewer (e.g. a
  `SUPPORT` user without `products:write` querying the global view), those
  records are omitted from `entries`, not merely hidden client-side
  (FR-D09/SC-... security requirement — filtering happens server-side).
- Empty `entries` because of the 24-month retention boundary is
  distinguishable from empty `entries` because none exist at all only via
  the `retentionWindowMonths` field and applied `dateFrom`/`dateTo` — the UI
  is responsible for stating "records older than 24 months have expired"
  when appropriate (FR-D14); the API's job is only to always report the
  window.

## Failure modes

- `401` — unauthenticated (standard `checkAdminAuth` behavior).
- `403` — authenticated but missing the required permission (global gate or
  the specific entity-type read permission for per-entity mode).
- `400` — malformed query (e.g. `entityId` without `entity`, invalid date).
- `500` — unexpected error, via `handleApiError`, logged with `logger`.

## Non-goals

- No write endpoints. Activity entries are immutable except for the
  scheduled retention deletion (FR-D08); there is no `POST`, `PATCH`, or
  `DELETE` on this route.
- Does not change how `recordAdminAuditLog` is called; this is purely a read
  path over the existing/extended `AdminAuditLog` table.
