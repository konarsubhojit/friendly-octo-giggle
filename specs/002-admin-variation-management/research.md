# Research: Admin Product Variation Management

**Feature**: 002-admin-variation-management  
**Date**: 2026-03-19  
**Status**: Complete

## Research Tasks & Findings

### R1: Soft-Delete Strategy for Product Variations

**Context**: Spec requires variations to be soft-deleted so order history shows original variation details.

**Decision**: Add a `deletedAt` timestamp column (nullable) to `productVariations` table.

**Rationale**:

- `deletedAt` timestamp is the established soft-delete pattern already used by the `products` table in this codebase.
- A nullable timestamp is more informative than a boolean `isActive` — it records when the deletion happened for audit purposes.
- Drizzle ORM supports `isNull()` filtering, making query-level filtering straightforward.
- Order items reference `variationId` via foreign key — the variation row must remain in the DB for the FK to resolve.

**Alternatives considered**:

- `isActive: boolean` — Simpler but loses temporal information. Rejected.
- Hard delete + snapshot into order items — Requires denormalization and schema change on orderItems. More complex and fragile. Rejected.
- Separate archive table — Over-engineering for the current scale. Rejected.

---

### R2: Drizzle ORM Relation-Level Filtering for Soft Delete

**Context**: Many queries use `with: { variations: true }` which loads all variations. Need to filter out soft-deleted ones for customer-facing queries.

**Decision**: Use Drizzle's relation-level `where` clause in `with:` for customer-facing queries. Keep unfiltered for admin order history.

**Rationale**:

- Drizzle v0.45 supports `with: { variations: { where: (v, { isNull }) => isNull(v.deletedAt) } }` in relational queries.
- For the dedicated variation query in `findBestsellers()`, add `and(inArray(...), isNull(pv.deletedAt))`.
- Order-related queries (order list, order detail) intentionally skip this filter to show historical data.
- Admin variation list also filters (only show active variations for management), but order views don't.

**Alternatives considered**:

- Post-query JavaScript filtering — Works but wasteful (fetches unnecessary rows from DB). Rejected for customer-facing paths.
- Database view — Over-engineering; adds DDL complexity. Rejected.

**Impacted query locations** (from codebase exploration):

| File                              | Line                  | Query                                                   | Action                                      |
| --------------------------------- | --------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `lib/db.ts`                       | ~125                  | `findAll()` → `with: { variations: true }`              | Add `where: isNull(deletedAt)`              |
| `lib/db.ts`                       | ~230                  | `findBestsellers()` → `findMany()`                      | Add `isNull(deletedAt)` to where            |
| `lib/db.ts`                       | ~320                  | `findById()` → `with: { variations: true }`             | Add `where: isNull(deletedAt)`              |
| `lib/db.ts`                       | ~423                  | wishlist `getProducts()` → `with: { variations: true }` | Add `where: isNull(deletedAt)`              |
| `app/api/cart/route.ts`           | ~50, ~208, ~221, ~349 | cart queries with nested variations                     | Add `where: isNull(deletedAt)`              |
| `app/api/orders/route.ts`         | ~317                  | order creation → variation lookup                       | Add `isNull(deletedAt)` check               |
| `app/api/orders/**`               | multiple              | order list/detail → `variation: true`                   | NO FILTER — historical integrity            |
| `app/api/admin/orders/**`         | multiple              | admin order views                                       | NO FILTER — audit trail                     |
| `app/api/admin/products/route.ts` | ~87                   | admin product list                                      | Filter in admin variation list UI, not here |

---

### R3: Admin Product Edit Page Architecture

**Context**: Spec requires a dedicated product edit page at `/admin/products/[id]` replacing the modal-based pattern.

**Decision**: Create a new App Router page at `app/admin/products/[id]/page.tsx` as a Server Component that fetches product + variations, passing data to Client Components for forms.

**Rationale**:

- Server Component fetches product data directly from DB (no API roundtrip), following the existing performance pattern in the codebase.
- Client Components handle interactivity: `ProductEditForm` for product fields, `VariationList` for displaying/managing variations, `VariationFormModal` for create/edit modals.
- This matches the project's Server-First Rendering principle (Constitution I).
- The existing `ProductFormModal` code can be largely extracted into `ProductEditForm` (same fields, different layout — inline instead of modal).
- Admin products list page will link to `/admin/products/[id]` for editing instead of opening a modal.

**Alternatives considered**:

- Tab-based layout (product tab + variations tab) — Adds navigation complexity. Single scrollable page is simpler for admin workflows. Rejected.
- Keep modal for product editing, separate page only for variations — Inconsistent UX, user clarification explicitly requested a full edit page. Rejected.

---

### R4: Variation API Endpoint Design

**Context**: Need CRUD endpoints for variations scoped to a product.

**Decision**: RESTful endpoints nested under the product:

- `GET /api/admin/products/[id]/variations` — List active variations
- `POST /api/admin/products/[id]/variations` — Create variation
- `PUT /api/admin/products/[id]/variations/[variationId]` — Update variation
- `DELETE /api/admin/products/[id]/variations/[variationId]` — Soft-delete variation

**Rationale**:

- Nesting under products clearly scopes variations to a product.
- Follows the existing pattern of `/api/admin/products/[id]/route.ts`.
- Separate GET endpoint for variations (rather than only fetching via product) allows independent loading and refresh after mutations.
- All endpoints reuse existing auth pattern (`auth()` + role check).

**Alternatives considered**:

- Flat endpoints like `/api/admin/variations?productId=xxx` — Less RESTful, doesn't leverage URL hierarchy. Rejected.
- Including variation CRUD in the product PUT endpoint — Mixes concerns, complicates validation. Rejected.

---

### R5: Validation Schema Design

**Context**: Need Zod schemas for variation create and update operations.

**Decision**: Two new schemas in `lib/validations.ts`:

```
CreateVariationSchema:
  - name: string, 1–100 chars, required
  - designName: string, 1–100 chars, required
  - priceModifier: number, required (can be negative)
  - stock: integer, non-negative, required
  - image: string URL, optional
  - images: string URL array, max 10 items, optional

UpdateVariationSchema:
  - Same fields as create but all optional (partial update)
```

**Rationale**:

- Follows the existing pattern of `ProductInputSchema` / `ProductUpdateSchema`.
- `priceModifier` is required on create (no default) per clarification Q4.
- `stock` is required on create (no default) per clarification Q4.
- Image fields are optional — variations can function without images (fallback to product images).
- Max image count aligns with existing product image limits.

---

### R6: Effective Price Validation

**Context**: FR-008 requires the effective price (base + modifier) > 0.

**Decision**: Validate at the API layer, not in the Zod schema. The API checks `product.price + variation.priceModifier > 0` before saving.

**Rationale**:

- The Zod schema validates variation fields in isolation — it doesn't have access to the product's base price.
- The API route already has the product loaded (validated via `[id]` param). Checking the effective price there is natural and efficient.
- Client-side form can also show a warning using the product price available in the page component.

---

### R7: 25-Variation Limit Enforcement

**Context**: Spec requires max 25 active variations per product.

**Decision**: Enforce at the API layer in the POST endpoint. Before creating, count active (non-soft-deleted) variations for the product and reject if >= 25.

**Rationale**:

- DB-level constraint (CHECK on count) would be complex and fragile across soft-delete logic.
- Application-level enforcement is straightforward: one COUNT query before INSERT.
- Race condition is marginal (two admins adding the 25th variation simultaneously) and the DB unique constraint prevents duplicates. Worst case: 26 variations (harmless).

---

### R8: Cache Invalidation Strategy

**Context**: Variation mutations must invalidate caches so customers see current data.

**Decision**: Reuse existing `invalidateProductCaches(productId)` from the product API. Add variation-specific cache key patterns.

**Rationale**:

- Variation changes affect the parent product's cached representation (the product includes variations).
- Invalidating `product:{id}` and `products:all` covers all customer-facing caches.
- No separate variation-level cache is needed — variations are always fetched as part of a product.
- Add `ADMIN_PRODUCT_VARIATIONS` pattern for admin-side caching if needed, but initial implementation can skip admin caching for simplicity (admin pages hit DB directly).

**Cache keys to invalidate on variation mutation**:

- `product:{productId}` — Product detail cache
- `products:all` — Product list cache
- `products:bestsellers` — Bestsellers cache
- `admin:products:*` — Admin product list cache
