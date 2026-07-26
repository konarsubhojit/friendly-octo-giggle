ALTER TYPE "public"."UserRole" ADD VALUE 'SUPPORT';--> statement-breakpoint
ALTER TYPE "public"."UserRole" ADD VALUE 'FULFILMENT';--> statement-breakpoint
ALTER TABLE "AdminAuditLog" ADD COLUMN "role" "UserRole";