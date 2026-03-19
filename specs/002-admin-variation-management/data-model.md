# Data Model: Admin Product Variation Management

**Feature**: 002-admin-variation-management  
**Date**: 2026-03-19

## Entity Relationship

```
┌──────────────┐       ┌─────────────────────┐
│   products   │ 1───* │ productVariations    │
│──────────────│       │─────────────────────│
│ id (PK)      │       │ id (PK)             │
│ name         │       │ productId (FK)      │
│ description  │       │ name                │
│ price        │       │ designName          │
│ image        │       │ image               │
│ images[]     │       │ images[]            │
│ stock        │       │ priceModifier       │
│ category     │       │ stock               │
│ deletedAt    │       │ deletedAt ← NEW     │
│ createdAt    │       │ createdAt           │
│ updatedAt    │       │ updatedAt           │
└──────────────┘       └─────────────────────┘
                              │
                       ┌──────┤ (referenced by)
                       │      │
               ┌───────▼──┐  ┌▼──────────┐
               │ cartItems │  │ orderItems │
               │──────────│  │───────────│
               │variationId│  │variationId│
               │(optional) │  │(optional) │
               └───────────┘  └───────────┘
```

## Schema Change: `productVariations` Table

### New Column

| Column | Type | Default | Nullable | Index | Description |
|--------|------|---------|----------|-------|-------------|
| `deletedAt` | `timestamp` | `null` | YES | No (low cardinality) | Soft-delete marker. `null` = active, non-null = archived. |

### Migration SQL (Drizzle-generated)

```sql
ALTER TABLE "product_variations" ADD COLUMN "deleted_at" timestamp;
```

### Drizzle Schema Change

```typescript
// In lib/schema.ts, add to productVariations table definition:
deletedAt: timestamp("deleted_at"),
```

## Existing Columns (unchanged)

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| `id` | `varchar(7)` | NO | PK, Base62 short ID | Unique variation identifier |
| `productId` | `varchar(7)` | NO | FK → products.id (CASCADE) | Parent product |
| `name` | `text` | NO | UNIQUE(productId, name) | Variation display name (e.g., "Red - Large") |
| `designName` | `text` | NO | — | Design identifier (e.g., "Classic Logo") |
| `image` | `text` | YES | — | Primary variation image URL |
| `images` | `json` | NO | DEFAULT `[]` | Additional variation image URLs |
| `priceModifier` | `doublePrecision` | NO | DEFAULT `0` | Price adjustment from base product price |
| `stock` | `integer` | NO | — | Variation-specific stock quantity |
| `createdAt` | `timestamp` | NO | DEFAULT `now()` | Creation timestamp |
| `updatedAt` | `timestamp` | NO | DEFAULT `now()` | Last update timestamp |

## Validation Rules

### Create Variation

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | YES | 1–100 characters |
| `designName` | string | YES | 1–100 characters |
| `priceModifier` | number | YES | Any number (positive or negative); effective price (product.price + modifier) must be > 0 |
| `stock` | integer | YES | Non-negative integer (≥ 0) |
| `image` | string | NO | Valid URL |
| `images` | string[] | NO | Array of valid URLs, max 10 items |

### Update Variation

All fields from Create are optional (partial update). Same constraints apply to provided fields. Effective price validation applies if `priceModifier` is provided.

### Business Rules

1. **Unique name per product**: `(productId, name)` unique constraint. The unique constraint applies only among active (non-deleted) variations. The DB constraint remains as-is; the API validates uniqueness among non-deleted variations before insert/update.
2. **Max 25 active variations per product**: Enforced at API layer before create.
3. **Soft delete does NOT release the unique name**: A soft-deleted variation's name remains reserved in the DB unique constraint. If the admin wants to reuse a name, the current implementation requires a different name. This is acceptable for the initial implementation.
4. **Effective price > 0**: Validated at API layer using `product.price + variation.priceModifier > 0`.
5. **Stock required on create**: No default; admin must explicitly set a value.

## State Transitions

```
[Active] ──(soft delete)──▶ [Archived]
   │                            │
   │ Visible to:                │ Visible to:
   │ • Customers                │ • Order history only
   │ • Admin variation list     │ • NOT admin variation list
   │ • Cart/checkout            │ • NOT cart/checkout
   │                            │ • NOT product detail
   └────────────────────────────┘
```

No transition from Archived back to Active in the initial implementation. Reactivation can be added later if needed.
