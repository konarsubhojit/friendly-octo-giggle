# Database Migrations Guide

This guide explains how to manage database schema changes using Prisma Migrate.

## Overview

Prisma Migrate is a declarative database schema migration tool. It uses the Prisma schema as the source of truth and generates SQL migrations that can be applied to your database.

## Migration Workflow

### 1. Making Schema Changes

Edit `prisma/schema.prisma` to reflect your desired database structure:

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  description String
  // Add new field
  featured    Boolean  @default(false)
}
```

### 2. Create a Migration

```bash
npm run db:migrate -- --name add_featured_to_products
```

This command will:
1. Compare your schema with the current database state
2. Generate SQL migration files in `prisma/migrations/`
3. Apply the migration to your database
4. Regenerate the Prisma Client

### 3. Review the Generated Migration

Check `prisma/migrations/YYYYMMDDHHMMSS_add_featured_to_products/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Product" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
```

### 4. Commit the Migration

```bash
git add prisma/schema.prisma
git add prisma/migrations/
git commit -m "Add featured field to products"
```

## Common Migration Scenarios

### Adding a New Model

```prisma
model Category {
  id       String    @id @default(cuid())
  name     String    @unique
  products Product[]
}

model Product {
  id         String    @id @default(cuid())
  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id])
}
```

```bash
npm run db:migrate -- --name add_categories
```

### Adding an Index

```prisma
model Product {
  name     String
  category String
  
  @@index([category])
  @@index([name, category])
}
```

```bash
npm run db:migrate -- --name add_product_indexes
```

### Renaming a Field

```prisma
// Option 1: Add new field, migrate data, remove old field
// Option 2: Use @map to rename without data migration

model Product {
  productName String @map("name") // Maps to existing 'name' column
}
```

### Adding a Required Field

For existing data, use a two-step migration:

**Step 1**: Add as optional
```prisma
model Product {
  sku String?
}
```

```bash
npm run db:migrate -- --name add_sku_optional
```

**Step 2**: Populate data, then make required
```bash
# Update existing records
npx tsx scripts/populate-sku.ts
```

```prisma
model Product {
  sku String
}
```

```bash
npm run db:migrate -- --name make_sku_required
```

## Production Deployment

### Applying Migrations

In production environments, use `prisma migrate deploy`:

```bash
# This applies pending migrations without prompting
npx prisma migrate deploy
```

### CI/CD Integration

**Vercel/Serverless:**
```json
// package.json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

**Docker:**
```dockerfile
RUN npx prisma generate
RUN npx prisma migrate deploy
```

### Rolling Back Migrations

Prisma Migrate doesn't support automatic rollback. To rollback:

1. Restore database from backup
2. Remove failed migration from `prisma/migrations/`
3. Fix the schema issue
4. Create a new migration

## Best Practices

### 1. Always Review Generated SQL

Before committing, check the migration file to ensure it does what you expect:

```bash
cat prisma/migrations/*/migration.sql
```

### 2. Test Migrations Locally First

```bash
# Create a test database
createdb ecommerce_test

# Apply migration
DATABASE_URL=******localhost/ecommerce_test npm run db:migrate
```

### 3. Use Descriptive Migration Names

```bash
# Good
npm run db:migrate -- --name add_user_preferences
npm run db:migrate -- --name create_wishlist_table

# Bad
npm run db:migrate -- --name update
npm run db:migrate -- --name fix
```

### 4. Never Edit Existing Migrations

Once a migration is applied (especially in production), never edit it. Instead:
- Create a new migration to fix issues
- Use `prisma migrate resolve` for marking failed migrations

### 5. Keep Migrations Small

Make incremental changes instead of large schema overhauls:
- Easier to review
- Easier to rollback if needed
- Reduces risk of data loss

### 6. Backup Before Major Changes

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

### Migration Failed Partway Through

```bash
# Mark the migration as resolved (if you've fixed manually)
npx prisma migrate resolve --applied YYYYMMDDHHMMSS_migration_name

# Or mark as rolled back
npx prisma migrate resolve --rolled-back YYYYMMDDHHMMSS_migration_name
```

### Reset Development Database

```bash
# WARNING: This deletes all data!
npx prisma migrate reset

# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Apply all migrations
# 4. Run seed script
```

### Migration Out of Sync

```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy
```

### Generate Client After Schema Changes

```bash
# Regenerate Prisma Client
npm run db:generate
```

## Migration File Structure

```
prisma/
├── migrations/
│   ├── migration_lock.toml          # Locks to PostgreSQL
│   ├── 20240101000000_initial/
│   │   └── migration.sql
│   ├── 20240102000000_add_users/
│   │   └── migration.sql
│   └── 20240103000000_add_orders/
│       └── migration.sql
├── schema.prisma                     # Source of truth
└── seed.ts                           # Seed data script
```

## Data Migration Scripts

For complex data transformations, create TypeScript migration scripts:

```typescript
// scripts/migrate-data.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update all products to have a default category
  await prisma.product.updateMany({
    where: { category: null },
    data: { category: 'General' },
  });
  
  console.log('Migration complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run with:
```bash
npx tsx scripts/migrate-data.ts
```

## Schema Design Best Practices

### Normalization

Always use normalized relational tables:

```prisma
// Good - Normalized
model Order {
  id     String      @id
  userId String
  user   User        @relation(fields: [userId], references: [id])
  items  OrderItem[]
}

model OrderItem {
  id        String  @id
  orderId   String
  productId String
  order     Order   @relation(fields: [orderId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
}

// Bad - Denormalized (storing duplicate data)
model Order {
  id           String @id
  productNames String // Don't store comma-separated values
}
```

### Indexes

Add indexes for frequently queried fields:

```prisma
model Product {
  category String
  price    Float
  
  @@index([category])
  @@index([price])
  @@index([category, price]) // Composite index
}
```

### Foreign Keys

Always define proper foreign key relations:

```prisma
model OrderItem {
  orderId   String
  productId String
  
  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])
  
  @@index([orderId])
  @@index([productId])
}
```

## Environment-Specific Migrations

### Development
```bash
npm run db:migrate           # Interactive, creates migration
```

### Production
```bash
npx prisma migrate deploy    # Non-interactive, applies pending
```

### CI/CD
```bash
npx prisma migrate deploy --skip-seed  # Skip seeding in prod
```

## Monitoring Migrations

### Check Migration Status

```bash
npx prisma migrate status
```

Output:
```
Database schema is up to date!

Following migrations have been applied:
20240101000000_initial
20240102000000_add_users
20240103000000_add_orders
```

### Validate Schema

```bash
npx prisma validate
```

## References

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Migration Troubleshooting](https://www.prisma.io/docs/guides/migrate/troubleshooting)
- [Schema Design Best Practices](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate)
