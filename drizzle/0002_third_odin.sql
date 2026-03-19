CREATE TYPE "public"."EmailType" AS ENUM('order_confirmation', 'order_status_update');--> statement-breakpoint
CREATE TYPE "public"."FailedEmailStatus" AS ENUM('pending', 'failed', 'sent');--> statement-breakpoint
CREATE TABLE "FailedEmail" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"recipientEmail" text NOT NULL,
	"subject" text NOT NULL,
	"bodyHtml" text NOT NULL,
	"bodyText" text NOT NULL,
	"emailType" "EmailType" NOT NULL,
	"referenceId" varchar(7) NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"isRetriable" boolean DEFAULT true NOT NULL,
	"status" "FailedEmailStatus" DEFAULT 'pending' NOT NULL,
	"errorHistory" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastAttemptedAt" timestamp,
	"sentAt" timestamp
);
--> statement-breakpoint
CREATE INDEX "FailedEmail_status_idx" ON "FailedEmail" USING btree ("status");--> statement-breakpoint
CREATE INDEX "FailedEmail_referenceId_idx" ON "FailedEmail" USING btree ("referenceId");--> statement-breakpoint
CREATE INDEX "FailedEmail_createdAt_idx" ON "FailedEmail" USING btree ("createdAt");