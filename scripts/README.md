# Database Scripts

This directory contains SQL scripts for database management and deployment.

## Scripts

### `init-database.sql`

Idempotent SQL script for initializing the production database schema.

**Features:**
- Can be run multiple times safely (idempotent)
- Creates all tables, enums, indexes, and constraints
- Compatible with PostgreSQL 15+
- Includes proper foreign keys and cascading deletes
- Optimized indexes for performance

**Usage:**

```bash
# Using psql directly
psql -d your_database_name -f scripts/init-database.sql

# Using environment variable
psql $DATABASE_URL -f scripts/init-database.sql

# With connection parameters
psql -h hostname -U username -d database_name -f scripts/init-database.sql
```

**What it creates:**

1. **Enums:**
   - `UserRole` (CUSTOMER, ADMIN)
   - `OrderStatus` (PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)

2. **Authentication Tables:**
   - `User` - Application users
   - `Account` - OAuth provider accounts
   - `Session` - Active sessions
   - `VerificationToken` - Email verification tokens

3. **E-Commerce Tables:**
   - `Product` - Product catalog
   - `ProductVariation` - Product variants
   - `Order` - Customer orders
   - `OrderItem` - Order line items
   - `Cart` - Shopping carts
   - `CartItem` - Cart items

4. **Indexes:** All necessary indexes for optimal query performance

**Safety Features:**
- `CREATE IF NOT EXISTS` for all tables
- `DO $$ BEGIN ... EXCEPTION` blocks for enums
- Foreign key constraints with proper cascade rules
- Unique constraints where needed

**Production Deployment:**

This script is safe to use in production. It will:
- ✅ Skip creation if objects already exist
- ✅ Not modify existing data
- ✅ Not drop or alter existing tables
- ✅ Complete successfully even if schema exists

**Alternative Methods:**

If you're using Drizzle Kit for migrations:

```bash
# Generate migration from schema
npm run db:generate

# Push schema directly to database
npm run db:push

# Apply migrations
npm run db:migrate
```

**Verification:**

After running the script, verify the schema:

```bash
# List all tables
psql $DATABASE_URL -c "\dt"

# Check specific table structure
psql $DATABASE_URL -c "\d \"User\""

# Verify enums
psql $DATABASE_URL -c "\dT"
```
