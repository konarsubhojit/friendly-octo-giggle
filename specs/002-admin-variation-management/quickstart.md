# Quickstart: Admin Product Variation Management

**Feature**: 002-admin-variation-management  
**Branch**: `002-admin-variation-management`

## Prerequisites

- Node.js 18+
- PostgreSQL (Neon Serverless) — connection via `DATABASE_URL`
- Redis — connection via `REDIS_URL` (optional, defaults to localhost:6379)
- Environment variables configured in `.env.local`

## Setup

```bash
# 1. Switch to feature branch
git checkout 002-admin-variation-management

# 2. Install dependencies (if any new ones added)
npm install

# 3. Generate the migration for the soft-delete column
npm run db:generate

# 4. Review the generated SQL in drizzle/ directory
# Expected: ALTER TABLE "product_variations" ADD COLUMN "deleted_at" timestamp;

# 5. Apply the migration
npm run db:migrate

# 6. Start dev server
npm run dev
```

## Verification

### 1. Schema Change

```bash
# Open Drizzle Studio to verify the column was added
npm run db:studio
# Navigate to product_variations table → confirm deleted_at column exists
```

### 2. API Endpoints

```bash
# List variations for a product (replace PRODUCT_ID with a real ID)
curl -X GET http://localhost:3000/api/admin/products/PRODUCT_ID/variations \
  -H "Cookie: <admin-session-cookie>"

# Create a variation
curl -X POST http://localhost:3000/api/admin/products/PRODUCT_ID/variations \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{
    "name": "Red - Large",
    "designName": "Classic Logo",
    "priceModifier": 2.50,
    "stock": 100
  }'
```

### 3. Admin UI

1. Navigate to `http://localhost:3000/admin/products`
2. Click on any product card → should navigate to `/admin/products/[id]`
3. Product edit form should display at top, variations section below
4. Click "Add Variation" → form modal appears
5. Fill in fields and submit → variation appears in the list

### 4. Customer-Facing Verification

1. Navigate to the product page on the storefront
2. Newly created variation should appear as a selectable option
3. Soft-deleted variations should NOT appear

## Running Tests

```bash
# Run all tests
npm run test

# Run specific test files for this feature
npx vitest run __tests__/lib/validations.test.ts
npx vitest run __tests__/app/api/admin/products/
npx vitest run __tests__/components/admin/VariationFormModal.test.tsx
npx vitest run __tests__/components/admin/VariationList.test.tsx

# Run with coverage
npm run test:coverage
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/schema.ts` | `deletedAt` column added to `productVariations` |
| `lib/validations.ts` | `CreateVariationSchema`, `UpdateVariationSchema` |
| `lib/db.ts` | Soft-delete filtering in variation queries |
| `app/admin/products/[id]/page.tsx` | Dedicated product edit page |
| `app/api/admin/products/[id]/variations/route.ts` | GET + POST endpoints |
| `app/api/admin/products/[id]/variations/[variationId]/route.ts` | PUT + DELETE endpoints |
| `components/admin/VariationList.tsx` | Variation cards list |
| `components/admin/VariationFormModal.tsx` | Create/edit form modal |
