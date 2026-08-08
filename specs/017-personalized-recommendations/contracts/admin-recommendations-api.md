# Contract: Admin Recommendations API

Two route handlers under `src/app/api/admin/recommendations/`. Both call
`checkAdminAuth('system:manage')` from
`src/features/admin/services/admin-auth.ts` — no inline auth checks
(Constitution Principle V).

The admin page `src/app/admin/recommendations/page.tsx` uses
`requireAdminPermission('system:manage')` from
`src/features/admin/services/admin-page-auth.ts`.

`system:manage` is chosen because this is an operational job dashboard, the
same category as the existing email-failures surface — not a merchandising
tool, which would warrant `products:write`.

---

## `GET /api/admin/recommendations/status`

Answers FR-014's "see when scores were last refreshed".

### Request

No body, no parameters.

### Success response — `200`

```json
{
  "success": true,
  "data": {
    "lastComputedAt": "2026-08-08T04:00:12.431Z",
    "pairCount": 18432,
    "anchorCount": 1204,
    "windowDays": 180,
    "minSupport": 3
  }
}
```

| Field            | Source                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| `lastComputedAt` | `MAX(computedAt)` from `ProductAffinityScore`; `null` if the table is empty |
| `pairCount`      | `COUNT(*)`                                                                  |
| `anchorCount`    | `COUNT(DISTINCT anchorProductId)`                                           |
| `windowDays`     | `AFFINITY_WINDOW_DAYS` constant                                             |
| `minSupport`     | `MIN_SUPPORT` constant                                                      |

Cached through `getCachedData` under `CACHE_KEYS.RECOMMENDATIONS_STATUS` with
`CACHE_TTL.RECOMMENDATIONS_STATUS` (60s) — the two `COUNT`s are the expensive
part and a minute of staleness is irrelevant for a daily job.

### Error responses

| Status | When                                |
| ------ | ----------------------------------- |
| `401`  | No session                          |
| `403`  | Session lacks `system:manage`       |
| `500`  | Query failure, via `handleApiError` |

---

## `POST /api/admin/recommendations/recompute`

Triggers an out-of-schedule scoring run (FR-014).

### Request body

```ts
export const RecomputeRequestSchema = z.object({
  windowDays: z.coerce.number().int().min(7).max(365).optional(),
})
```

`windowDays` overrides `AFFINITY_WINDOW_DAYS` for this run only. Omitted in
normal use; present so an operator can widen the window on a cold catalog
without a deploy.

### Behaviour

Publishes `recommendations/affinity.recompute` through
`publishWithTimeout` from `src/lib/inngest/dispatch.ts`. The route does
**not** run the scoring inline — it returns as soon as the event is accepted.

Recomputation is not queued per-caller: Inngest's function-level concurrency
limit of `1` guarantees a second trigger while a run is in flight is
serialized rather than run in parallel.

### Success response — `202`

```json
{
  "success": true,
  "data": {
    "accepted": true,
    "dispatch": "published"
  }
}
```

`dispatch` is the `WorkflowDispatchResult` value — `published`, `fallback`, or
`dropped` — surfaced so the admin UI can distinguish "queued" from "Inngest is
unconfigured in this environment".

### Error responses

| Status | When                                   |
| ------ | -------------------------------------- |
| `400`  | `windowDays` out of range              |
| `401`  | No session                             |
| `403`  | Session lacks `system:manage`          |
| `500`  | Dispatch failure, via `handleApiError` |

---

## Admin page — `/admin/recommendations`

Server Component. Reads status server-side (no client fetch on first paint),
renders:

- last refresh timestamp, or "never computed" when `lastComputedAt` is `null`
- pair and anchor counts
- the active window and minimum-support values, so an operator can see why a
  sparse catalog produces few rows
- a "Recompute now" button — a Client Component posting to the recompute route
  and reflecting the returned `dispatch` value

No score browsing, editing, or manual curation. Manual merchandising rules are
explicitly out of scope in the spec.
