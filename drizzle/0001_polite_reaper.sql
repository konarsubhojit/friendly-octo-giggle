CREATE TYPE "public"."CheckoutRequestStatus" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."EmailType" AS ENUM('order_confirmation', 'order_status_update');--> statement-breakpoint
CREATE TYPE "public"."FailedEmailStatus" AS ENUM('pending', 'failed', 'sent');--> statement-breakpoint
CREATE TABLE "Category" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "Category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "CheckoutRequest" (
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
ALTER TABLE "OrderItem" ALTER COLUMN "orderId" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "id" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "Review" ALTER COLUMN "orderId" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "checkoutRequestId" varchar(7);--> statement-breakpoint
ALTER TABLE "ProductVariation" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "currencyPreference" varchar(3) DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD CONSTRAINT "CheckoutRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "CheckoutRequest_userId_idx" ON "CheckoutRequest" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "CheckoutRequest_status_idx" ON "CheckoutRequest" USING btree ("status");--> statement-breakpoint
CREATE INDEX "CheckoutRequest_createdAt_idx" ON "CheckoutRequest" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "FailedEmail_status_idx" ON "FailedEmail" USING btree ("status");--> statement-breakpoint
CREATE INDEX "FailedEmail_referenceId_idx" ON "FailedEmail" USING btree ("referenceId");--> statement-breakpoint
CREATE INDEX "FailedEmail_createdAt_idx" ON "FailedEmail" USING btree ("createdAt");--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES "public"."CheckoutRequest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Order_status_idx" ON "Order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Order_createdAt_idx" ON "Order" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Product_createdAt_idx" ON "Product" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Product_deletedAt_idx" ON "Product" USING btree ("deletedAt");--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutRequestId_key" UNIQUE("checkoutRequestId");