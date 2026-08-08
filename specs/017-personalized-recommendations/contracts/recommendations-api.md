# Contract: Public Recommendations API

Two route handlers under `src/app/api/recommendations/`. Both are wrapped in
`withApiLogging` and return through `apiSuccess` / `apiError` /
`handleApiError` from `src/lib/api-utils.ts`.

The product, cart, and zero-result surfaces render server-side and call the
selection service directly — they do **not** go through HTTP. Only the seeded
personalized rail needs a route, because its input (recently-viewed IDs) lives
in the browser.

---

## `GET /api/recommendations/personalized`

Returns a personalized rail for the requesting shopper, seeded with
client-supplied recently-viewed product IDs.

### Query parameters

| Name    | Type   | Required | Constraint                                                |
| ------- | ------ | -------- | --------------------------------------------------------- |
| `seeds` | string | no       | Comma-separated product IDs, max 12, each exactly 7 chars |
| `limit` | number | no       | `1..12`, default `8`                                      |

```ts
export const PersonalizedQuerySchema = z.object({
  seeds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.string().length(7)).max(12)),
  limit: z.coerce.number().int().min(1).max(12).default(8),
})
```

### Behaviour

| Case                                      | Response                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Authenticated, has order/wishlist history | Scores for the union of `seeds` + own order anchors + own wishlist anchors                   |
| Authenticated, no history, has `seeds`    | Scores for `seeds` only                                                                      |
| Authenticated, no history, no `seeds`     | Bestsellers, `fallback: true`                                                                |
| Guest (no session)                        | Bestsellers, `fallback: true`. **No per-user read, no cache write keyed by any identifier.** |
| Redis unavailable                         | Bestsellers, `fallback: true`, HTTP `200`                                                    |

The guest branch returns before any per-user query executes — FR-009 is
satisfied by control flow, not by cleanup.

### Success response — `200`

```json
{
  "success": true,
  "data": {
    "surface": "home",
    "fallback": false,
    "products": [
      {
        "id": "aB3xY9z",
        "name": "Ceramic Mug",
        "image": "https://…",
        "price": 899,
        "category": "Kitchen",
        "inStock": true
      }
    ]
  }
}
```

`products` uses the `RecommendationItem` projection defined in
`src/features/recommendations/validations.ts` — **not** `ProductGridItem`,
which carries numeric `stock` and `soldCount` fields and would violate FR-010.
`RecommendationItem` exposes `inStock: boolean` and no stock magnitude.
`price` is in INR, the storage base currency; formatting happens client-side
through `formatPrice`.

### Error responses

| Status | When                                                |
| ------ | --------------------------------------------------- |
| `400`  | `seeds` or `limit` fails schema validation          |
| `500`  | Unexpected failure not covered by the fallback path |

There is deliberately **no `401`**: an unauthenticated caller gets the guest
path, not an error. The rail must never be a reason a page shows an error.

### Caching

`Cache-Control: private, no-store` for the authenticated branch (per-user
data), `public, max-age=60` for the guest branch.

---

## `POST /api/recommendations/event`

Records a rail impression or a rail click. Mirrors
`src/app/api/search/click/route.ts`: Zod-validated, `logBusinessEvent`, no
persistence.

### Request body

```ts
export const RecommendationEventSchema = z.object({
  type: z.enum(['impression', 'click']),
  surface: z.enum(['product', 'cart', 'home', 'zero_result']),
  anchorProductId: z.string().length(7).nullable().default(null),
  productIds: z.array(z.string().length(7)).min(1).max(12),
  fallback: z.boolean().default(false),
})
```

For `type: 'click'`, `productIds` must contain exactly one element; enforced
with a `.refine`.

### Success response — `200`

```json
{ "success": true, "data": { "ok": true } }
```

### Error responses

| Status | When                         |
| ------ | ---------------------------- |
| `400`  | Body fails schema validation |

### Transport

Client sends via `navigator.sendBeacon` with a `fetch` fallback, the pattern
already used in `src/features/product/components/ProductGrid.tsx`. Beacon
failures are silent by design — analytics must never surface an error to a
shopper.

### Rate limiting

Applied through the existing `src/lib/rate-limit.ts` helper, keyed by session
ID or IP, since this endpoint is unauthenticated and write-shaped.
