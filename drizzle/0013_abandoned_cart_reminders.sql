-- Idempotent by design.
--
-- This migration's journal entry carried a timestamp one year in the past
-- (2025-07-27, versus 2026-07-26 for 0012), which made drizzle skip it: the
-- migrator applies an entry only when `lastDbMigration.created_at <
-- migration.folderMillis`, comparing against the single highest recorded
-- timestamp. The entry has since been corrected to sort after 0012.
--
-- Correcting the timestamp means environments that already carry these objects
-- — created by `scripts/sql/bootstrap-drizzle-initial.sql` or by an earlier
-- hand-run — would otherwise fail here on "already exists". Every statement is
-- therefore guarded, so the migration converges to the same schema from any
-- starting state.
ALTER TYPE "public"."EmailType" ADD VALUE IF NOT EXISTS 'abandoned_cart_reminder';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AbandonedCartReminder" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"cartId" varchar(7) NOT NULL,
	"userId" text NOT NULL,
	"reminderNumber" integer NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."AbandonedCartReminder"'::regclass
      AND conname = 'AbandonedCartReminder_cartId_Cart_id_fk'
  ) THEN
    ALTER TABLE "AbandonedCartReminder" ADD CONSTRAINT "AbandonedCartReminder_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."AbandonedCartReminder"'::regclass
      AND conname = 'AbandonedCartReminder_userId_User_id_fk'
  ) THEN
    ALTER TABLE "AbandonedCartReminder" ADD CONSTRAINT "AbandonedCartReminder_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "AbandonedCartReminder_cartId_reminderNumber_key" ON "AbandonedCartReminder" USING btree ("cartId","reminderNumber");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AbandonedCartReminder_cartId_idx" ON "AbandonedCartReminder" USING btree ("cartId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AbandonedCartReminder_userId_idx" ON "AbandonedCartReminder" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AbandonedCartReminder_sentAt_idx" ON "AbandonedCartReminder" USING btree ("sentAt");
