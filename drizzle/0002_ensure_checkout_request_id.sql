-- Idempotent migration: ensure CheckoutRequest table and Order.checkoutRequestId column exist.
-- This is a recovery migration for production databases where migration 0001 was not applied.
-- Safe to run on databases that already have the column (IF NOT EXISTS / IF NOT EXISTS guards).

-- Ensure CheckoutRequestStatus enum exists
DO $$ BEGIN
  CREATE TYPE "public"."CheckoutRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Ensure CheckoutRequest table exists
CREATE TABLE IF NOT EXISTS "CheckoutRequest" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"customerAddress" text NOT NULL,
	"items" json NOT NULL,
	"status" "CheckoutRequestStatus" DEFAULT 'PENDING' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Ensure checkoutRequestId column exists on Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "checkoutRequestId" varchar(7);
--> statement-breakpoint

-- Ensure foreign key constraints exist (safe to ignore if already present)
DO $$ BEGIN
  ALTER TABLE "CheckoutRequest" ADD CONSTRAINT "CheckoutRequest_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutRequestId_CheckoutRequest_id_fk"
    FOREIGN KEY ("checkoutRequestId") REFERENCES "public"."CheckoutRequest"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutRequestId_key" UNIQUE("checkoutRequestId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS "CheckoutRequest_userId_idx" ON "CheckoutRequest" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "CheckoutRequest_status_idx" ON "CheckoutRequest" USING btree ("status");
CREATE INDEX IF NOT EXISTS "CheckoutRequest_createdAt_idx" ON "CheckoutRequest" USING btree ("createdAt");