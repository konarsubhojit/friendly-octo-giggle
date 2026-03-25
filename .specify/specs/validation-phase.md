# Validation Phase Specification

**Branch**: `copilot/fix-header-and-image-display`  
**Created**: 2025-01-29  
**Status**: Active  
**Purpose**: Define the quality-gate tasks that must pass before this branch is merged to master.

---

## 1. Scope — What Was Changed

The following files were introduced or modified in this branch and are the subject of all validation below:

| Area                 | Changed Files                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Root layout / header | `app/layout.tsx`, `components/layout/HeaderWrapper.tsx`                                                                    |
| Product page         | `app/products/[id]/ProductClient.tsx`, `app/products/[id]/loading.tsx`                                                     |
| Image carousel       | `components/product/ImageCarousel.tsx` (new)                                                                               |
| Admin form           | `components/admin/ProductFormModal.tsx`                                                                                    |
| DB schema            | `lib/schema.ts`, `lib/types.ts`, `lib/validations.ts`, `drizzle/0005_add_product_images.sql`, `drizzle/meta/_journal.json` |
| CSS / static pages   | `app/globals.css`, all `app/*/page.tsx` pages that previously rendered their own `<Header />`                              |

---

## 2. Unit Tests — Pass / Update Requirements

### 2.1 Tests That Must Continue to Pass (regression)

These existing test files cover code that was modified and must still be green with no changes:

| Test File                                              | What It Guards                                                                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/components/admin/ProductFormModal.test.tsx` | All 620 lines of existing form-modal behaviour; `images` field was added to the component state so `mockProduct` fixtures may need the new `images: []` field appended |
| `__tests__/components/layout/Header.test.tsx`          | Header rendering in isolation — must still pass; Header itself was not changed                                                                                         |
| `__tests__/lib/validations.test.ts`                    | Zod schema changes — `images` field added to `ProductSchema`; existing tests must not regress                                                                          |
| `__tests__/lib/schema.test.ts`                         | Drizzle column list tests — `images` column must now appear for both `products` and `productVariations` tables                                                         |
| `__tests__/lib/features/cart/cartSlice.test.ts`        | Cart state; no changes needed but must stay green                                                                                                                      |
| `__tests__/app/api/admin/products/route.test.ts`       | Admin products CRUD — `images` field is now part of input/output                                                                                                       |
| `__tests__/app/api/products/[id]/route.test.ts`        | Public product API — must return `images` array                                                                                                                        |
| `__tests__/app/api/upload/route.test.ts`               | Upload route used by multi-image upload in the form                                                                                                                    |

### 2.2 Tests That Need to Be Updated

| Test File                                              | Required Update                                                                                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/components/admin/ProductFormModal.test.tsx` | Add `images: []` to every `mockProduct` fixture (the type now requires it). Add cases for: multi-image upload (up to 10), exceeding 10-image cap shows error, removing an additional image, saving with `images` array persisted to payload. |
| `__tests__/lib/schema.test.ts`                         | Assert that the `products` table columns include `"images"` and the `productVariations` table columns include `"images"`.                                                                                                                    |
| `__tests__/lib/validations.test.ts`                    | Add cases for: `images` array accepts up to 10 valid URLs, rejects an 11th item, rejects a non-URL string in the array, accepts an empty array.                                                                                              |
| `__tests__/app/api/admin/products/route.test.ts`       | Include `images: []` (or a populated array) in all product fixtures passed through mock DB returns so serialisation tests reflect the new field.                                                                                             |

### 2.3 New Test Files Required

| New Test File                                         | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/components/product/ImageCarousel.test.tsx` | ① renders nothing when `images=[]`; ② renders a single image with no nav controls; ③ renders prev/next buttons, dot indicators, and thumbnail strip for multiple images; ④ auto-advances to next image after the configured interval; ⑤ clicking prev/next updates the active index; ⑥ clicking a thumbnail updates the active index; ⑦ ArrowRight / ArrowLeft key events advance/retreat; ⑧ wheel-down calls goNext, wheel-up calls goPrev; ⑨ counter badge shows "N / total"; ⑩ ARIA attributes are correct (`role="tablist"`, `aria-selected`, `aria-label` on container). |
| `__tests__/components/layout/HeaderWrapper.test.tsx`  | ① renders `<Header />` on a non-admin path (e.g. `/`); ② renders nothing on `/admin`; ③ renders nothing on `/admin/products`; ④ renders `<Header />` on `/products/abc`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `__tests__/app/products/ProductClient.test.tsx`       | ① quantity clamps to `effectiveStock` when a variation is selected that has lower stock, and `quantityMessage` reads "Only X available"; ② effectiveStock=0 shows out-of-stock panel, not the add-to-cart section; ③ switching variation resets `quantityMessage` when new stock is sufficient; ④ carousel images use variation images when a variation is selected; ⑤ carousel falls back to product images when variation has no images.                                                                                                                                    |

---

## 3. SonarQube Analysis — Files to Scan

All files listed in §1 must pass the project quality gate (`konarsubhojit_friendly-octo-giggle`). Priority issues to watch per file:

### 3.1 `components/product/ImageCarousel.tsx`

- **Cognitive complexity**: `goToIndex`, `goNext`, `goPrev`, and the two `useEffect` hooks for keyboard/wheel interact via `useCallback` chains — check complexity score.
- **`useEffect` dependency arrays**: Confirm `autoScrollRef` cleanup, `goNext` / `goPrev` memoisation, and key/wheel listener teardown are not flagged as missing dependencies or exhaustive-deps violations.
- **Accessibility rule**: Wheel handler calls `e.preventDefault()` (passive: false) — verify no SonarQube rule flags blocking default scroll as a UX issue.

### 3.2 `components/layout/HeaderWrapper.tsx`

- Minimal file; watch for unused-import or missing-return-type issues.

### 3.3 `components/admin/ProductFormModal.tsx`

- **File size / complexity**: Already 620+ lines in tests; the component itself grew with multi-image logic. Watch for "function too long" or "too many parameters" smells.
- **`totalImages` computation**: Verify no null-safety issues flagged on `formData.image || imageFile`.
- **`additionalFiles` state initialisation**: `Array(...).fill(null)` initialisation — watch for any array-mutation warnings.

### 3.4 `lib/schema.ts`

- JSON column typing (`$type<string[]>()`) — confirm no type-safety issues raised.

### 3.5 `lib/validations.ts`

- `.max(10, ...)` on the `images` array — confirm Zod chaining is not flagged.

### 3.6 `app/products/[id]/ProductClient.tsx`

- **Complexity**: Multiple nested sub-components and a multi-branch IIFE (`carouselImages`) — watch cognitive complexity score.
- **`useEffect` for quantity clamp**: Confirm `quantity` in the dependency array is not causing an infinite-loop pattern (it sets `quantity` inside the effect).

---

## 4. Code Review Checklist

Reviewers should verify each item before approving the PR.

### 4.1 Header / Layout

- [ ] No page under `app/` still renders its own `<Header />` directly (all must rely on `HeaderWrapper` in the root layout).
- [ ] `HeaderWrapper` correctly returns `null` for every path under `/admin` (check `startsWith("/admin")` covers `/admin`, `/admin/products`, `/admin/orders`, `/admin/users`).
- [ ] `HeaderSkeleton` is no longer rendered from any page-level `loading.tsx` that previously relied on the per-page Header pattern.
- [ ] The root `layout.tsx` wraps `<HeaderWrapper />` outside the `<AppProviders>` tree — or confirm it is inside and has access to all required context (currently it is inside `<AppProviders>` via the JSX structure, which is correct).

### 4.2 ImageCarousel

- [ ] Auto-scroll uses `setTimeout`, not `setInterval` — the ref is cleared in the `useEffect` cleanup; confirm no timer leak on unmount.
- [ ] Keyboard listener is attached to `containerRef`, not `window` — prevents page-level arrow-key hijacking when the carousel is not focused.
- [ ] Wheel listener uses `{ passive: false }` to call `preventDefault()` — confirm this is intentional and documented (prevents accidental page scroll when hovering the carousel).
- [ ] `isAnimating` guard in `goToIndex` prevents rapid-fire clicks from queuing multiple transitions.
- [ ] All `<Image>` tags have meaningful `alt` text (`"${productName} image N of total"` pattern).
- [ ] The thumbnail strip and dot indicators stay in sync with `currentIndex` after auto-scroll.
- [ ] `key={idx}` on mapped elements — acceptable here because the image list is static during a component's lifetime; confirm images array never reorders in place.
- [ ] **ARIA roles audit**: Dot indicators use `role="tab"` inside a `role="tablist"` container. This implies full keyboard tab-switching (Home/End keys) that is only partially implemented. Either complete the keyboard contract or replace with `role="radiogroup"` / `role="radio"` which has a lighter keyboard expectation.

### 4.3 DB Schema & Migration

- [ ] Migration `0005_add_product_images.sql` is safe to run on existing data: both `ALTER TABLE … ADD COLUMN … DEFAULT '[]'::json NOT NULL` statements provide a non-null default so no back-fill is needed.
- [ ] `drizzle/meta/_journal.json` entry is consistent with the migration file name and timestamp.
- [ ] `lib/schema.ts` JSON columns use `.$type<string[]>()` for TypeScript inference — confirm no raw `json()` call leaks `unknown` into the type system elsewhere.

### 4.4 `ProductFormModal` Multi-Image Upload

- [ ] The `MAX_IMAGES` constant (10) is enforced at the UI level before any upload is triggered — no extra images can be added once the cap is reached.
- [ ] Images are uploaded individually via the existing `/api/upload` route; confirm the form does not attempt a batch upload that bypasses server-side file-type and size validation.
- [ ] **Silent upload failures**: If any individual image upload fails mid-sequence the current code skips it silently. Confirm the form surfaces a warning (e.g. toast) after all uploads complete so the user knows fewer images were saved than intended.
- [ ] **`totalImages` cap clarity**: The `MAX_IMAGES = 10` cap counts the primary image plus additional images. Confirm the UI error message is explicit ("Maximum 10 images total, including primary image") to avoid user confusion.
- [ ] Removing an additional image slot correctly updates both `formData.images` and `additionalFiles` arrays in sync (no off-by-one leaving orphan file references).
- [ ] The `images` array is included in the `PATCH /api/admin/products/[id]` payload on edit.

### 4.5 Quantity Dropdown & Stock Clamping

- [ ] The `useEffect` that clamps `quantity` resets `quantityMessage` to `""` when stock is sufficient — verify no stale message persists after switching back to a high-stock variation.
- [ ] **`useEffect` dependency hazard**: The quantity-clamp effect reads and sets `quantity` in the same effect; confirm this does not trigger an infinite re-render cycle. The effect should be structured so setting `quantity` via `setQuantity(effectiveStock)` only fires when `quantity > effectiveStock`, not on every render.
- [ ] `effectiveStock === 0` path shows the out-of-stock panel and hides the entire `<AddToCartSection>` (not just disabling the button).
- [ ] The quantity `<select>` generates options from `1` to `min(effectiveStock, 10)` — confirm no off-by-one or empty option list when `effectiveStock === 1`.

### 4.6 Cart Line Items (variationId)

- [ ] `addToCart` dispatches `variationId: selectedVariation?.id ?? null` — the null case (base product) must be a distinct line item from any variation.
- [ ] Confirm the cart API (`POST /api/cart`) correctly creates a new line item rather than incrementing an existing one when `variationId` differs.

---

## 5. Security Concerns

### 5.1 Image URL Injection

- **Risk**: The `images` JSON column stores URL strings. A crafted URL pointing to an attacker-controlled host could be used to exfiltrate user cookies via a browser request or perform SSRF if the server ever fetches these URLs.
- **Check**: Confirm the Zod `URL_REGEX` in `lib/validations.ts` is sufficiently strict (must not allow `javascript:`, `data:`, or `file:` schemes). Review the regex pattern directly.
- **Check**: The `/api/admin/products` route must validate the `images` array through `ProductInputSchema` / `ProductUpdateSchema` before writing to the DB — confirm no raw insert bypasses Zod.

### 5.2 Upload Route Not Rate-Limited for Bulk Images

- **Risk**: Each of the up to 10 images in `ProductFormModal` triggers a separate `POST /api/upload`. Without rate limiting, an authenticated admin could hammer the upload endpoint.
- **Check**: Verify whether the upload route is protected by the existing API rate-limiting middleware (`lib/api-middleware.ts`). If not, document as accepted risk (admin-only endpoint).

### 5.3 File Type / Size Validation Enforcement

- **Risk**: Client-side guards in `ProductFormModal` (`isValidImageType`, `MAX_FILE_SIZE`) can be bypassed by a direct API call.
- **Check**: Confirm `app/api/upload/route.ts` independently re-validates file type and size server-side — this is already present per the source review, but must remain intact after any refactoring.

### 5.4 JSON Column Size Unbounded at DB Level

- **Risk**: The `images` JSON column has no DB-level size constraint. Zod enforces `.max(10)` items at the API layer, but a migration or direct DB write could insert an arbitrarily large array.
- **Check**: Confirm that all write paths (admin product create/update) pass through the Zod schema. Document that DB-level enforcement is absent but accepted given admin-only access.

### 5.5 Wheel Event `preventDefault` Scope

- **Risk**: `{ passive: false }` on the wheel listener in `ImageCarousel` prevents the browser from optimising scroll performance for the entire container. On mobile this could cause scroll jank on the product page.
- **Check**: Confirm the listener is attached to `containerRef` (the carousel div), not `document` or `window`, and that the carousel does not span the full page height in any viewport. This is a UX risk, not a security risk, but should be noted.

---

## 6. Acceptance Criteria for This Validation Phase

The branch is ready to merge when all of the following are true:

1. `npm run test` (Vitest) exits with 0 failures, including the new test files in §2.3 and the updated fixtures in §2.2.
2. All SonarQube issues in the files listed in §3 are either resolved or formally accepted (no new Blocker or Critical issues introduced).
3. Every item in the code review checklist (§4) is checked off by at least one reviewer.
4. The security checks in §5.1 and §5.3 are confirmed passing (URL regex review and server-side upload re-validation documented as verified).
5. The DB migration `0005_add_product_images.sql` has been applied to the staging environment without error.
