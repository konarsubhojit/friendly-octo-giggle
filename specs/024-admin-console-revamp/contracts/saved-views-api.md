# Contract: Saved Views API

New routes: `src/app/api/admin/saved-views/route.ts` (list, create) and
`src/app/api/admin/saved-views/[id]/route.ts` (rename, delete). Backs
FR-A17–FR-A21.

## Authorization

- All methods require the viewer to be an authenticated staff user
  (`checkAdminAuth` with the permission that gates the underlying
  `resource` query param — e.g. saving a view for `orders` requires
  `orders:read`, matching the permission already required to see the
  orders list at all).
- Mutating a saved view (`PATCH`/`DELETE` on `[id]`) additionally requires
  `ownerId === currentUserId`; built-in views (`isBuiltIn = true`) reject
  every mutation regardless of caller, including `ADMIN` (FR-A20 —
  "read-only").

## `GET /api/admin/saved-views?resource=<resource>`

Returns the views visible to the current viewer for that resource: their own
private views plus built-in views gated by `requiredPermission` (FR-A21 —
evaluated against the viewer's _current_ permissions at request time, not
permissions at creation time).

```ts
interface SavedViewsListResponse {
  views: ReadonlyArray<{
    id: string
    resource: string
    name: string
    criteria: {
      search?: string
      filters?: Record<string, unknown>
      sort?: { field: string; direction: 'asc' | 'desc' }
    }
    isBuiltIn: boolean
    owned: boolean // true only when ownerId === currentUserId
  }>
}
```

Never includes another user's private views — enforced by the query itself
(`WHERE ownerId = :currentUserId OR isBuiltIn = true`), not by
post-filtering, so a bug can't leak rows through an unfiltered response
(FR-A18, SC-018).

## `POST /api/admin/saved-views`

```ts
interface CreateSavedViewRequest {
  resource: string
  name: string
  criteria: {
    search?: string
    filters?: Record<string, unknown>
    sort?: { field: string; direction: 'asc' | 'desc' }
  }
}
```

- Validated with Zod against the resource's known filter/sort shape (so a
  saved view can never reference a filter the resource doesn't define).
- Always created with `ownerId = currentUserId`, `isBuiltIn = false`. The
  request body has no `ownerId` or `isBuiltIn` field — the server sets both,
  so a client cannot self-assign a built-in, shared view.
- Returns `201` with the created view (shape as in the list response).

## `PATCH /api/admin/saved-views/[id]`

Rename only (`{ name: string }`). Rejects with `403` if
`ownerId !== currentUserId` or `isBuiltIn === true`.

## `DELETE /api/admin/saved-views/[id]`

Rejects with `403` under the same conditions as `PATCH`. Returns `204` on
success.

## Failure modes

- `401` — unauthenticated.
- `403` — authenticated but lacking the resource's read permission, or
  attempting to mutate a view not owned by the caller, or attempting to
  mutate a built-in view.
- `400` — malformed `criteria` (unknown filter key, invalid sort direction).
- `404` — `[id]` does not exist, or exists but is filtered out of the
  caller's visibility (a private view belonging to someone else returns
  `404`, not `403`, to avoid confirming its existence to a non-owner).
- `500` — unexpected error via `handleApiError`.

## Non-goals

- No endpoint mutates or deletes built-in views; they are seeded, not
  managed through this API.
- No endpoint exposes another user's private views under any role,
  including `ADMIN` — `system:manage`/`ADMIN` does not grant visibility
  into other users' saved views; this is an ownership boundary, not a
  permission-level one.
