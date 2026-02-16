-- ============================================================================
-- E-Commerce Database Initialization Script (Idempotent)
-- ============================================================================
-- This script creates all necessary database objects for the e-commerce platform.
-- It is idempotent and can be run multiple times safely.
-- Compatible with PostgreSQL 15+
--
-- Usage: psql -d your_database -f scripts/init-database.sql
-- ============================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User Role Enum
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Order Status Enum
DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- ───────────────────────────────────────────────────────────────────────────
-- Authentication Tables (NextAuth.js compatible)
-- ───────────────────────────────────────────────────────────────────────────

-- Users Table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" TIMESTAMP,
  "image" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Accounts Table (OAuth)
CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS "Session" (
  "sessionToken" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Verification Tokens Table
CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expires" TIMESTAMP NOT NULL
);

-- ───────────────────────────────────────────────────────────────────────────
-- E-Commerce Tables
-- ───────────────────────────────────────────────────────────────────────────

-- Products Table
CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "image" TEXT NOT NULL,
  "stock" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Product Variations Table
CREATE TABLE IF NOT EXISTS "ProductVariation" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "designName" TEXT NOT NULL,
  "image" TEXT,
  "priceModifier" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stock" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProductVariation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
);

-- Orders Table
CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerAddress" TEXT NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variationId" TEXT,
  "quantity" INTEGER NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id"),
  CONSTRAINT "OrderItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id")
);

-- Carts Table
CREATE TABLE IF NOT EXISTS "Cart" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT UNIQUE,
  "sessionId" TEXT UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS "CartItem" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variationId" TEXT,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE,
  CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id"),
  CONSTRAINT "CartItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id")
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Account Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" 
  ON "Account" ("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account" ("userId");

-- Session Indexes
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");

-- Verification Token Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" 
  ON "VerificationToken" ("identifier", "token");

-- Product Indexes
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product" ("category");

-- Product Variation Indexes
CREATE INDEX IF NOT EXISTS "ProductVariation_productId_idx" 
  ON "ProductVariation" ("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariation_productId_name_key" 
  ON "ProductVariation" ("productId", "name");

-- Order Indexes
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order" ("userId");

-- Order Item Indexes
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem" ("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_variationId_idx" ON "OrderItem" ("variationId");

-- Cart Indexes
CREATE INDEX IF NOT EXISTS "Cart_sessionId_idx" ON "Cart" ("sessionId");

-- Cart Item Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_productId_variationId_key" 
  ON "CartItem" ("cartId", "productId", "variationId");
CREATE INDEX IF NOT EXISTS "CartItem_cartId_idx" ON "CartItem" ("cartId");
CREATE INDEX IF NOT EXISTS "CartItem_productId_idx" ON "CartItem" ("productId");
CREATE INDEX IF NOT EXISTS "CartItem_variationId_idx" ON "CartItem" ("variationId");

-- ============================================================================
-- COMMENTS (Optional - for documentation)
-- ============================================================================

COMMENT ON TABLE "User" IS 'Application users with authentication via NextAuth.js';
COMMENT ON TABLE "Account" IS 'OAuth provider accounts linked to users';
COMMENT ON TABLE "Session" IS 'Active user sessions';
COMMENT ON TABLE "VerificationToken" IS 'Email verification and password reset tokens';
COMMENT ON TABLE "Product" IS 'Product catalog with inventory tracking';
COMMENT ON TABLE "ProductVariation" IS 'Product variants (size, color, design)';
COMMENT ON TABLE "Order" IS 'Customer orders';
COMMENT ON TABLE "OrderItem" IS 'Line items in orders';
COMMENT ON TABLE "Cart" IS 'Shopping carts for authenticated and guest users';
COMMENT ON TABLE "CartItem" IS 'Items in shopping carts';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
  RAISE NOTICE 'Database initialization completed successfully!';
  RAISE NOTICE 'All tables, indexes, and constraints are in place.';
END $$;
