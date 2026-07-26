CREATE TABLE IF NOT EXISTS "WebhookEvent" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"provider" "PaymentProvider" NOT NULL,
	"eventId" text NOT NULL,
	"eventType" text NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	CONSTRAINT "WebhookEvent_provider_eventId_key" UNIQUE("provider","eventId")
);
--> statement-breakpoint
ALTER TABLE "OrderItem" ALTER COLUMN "price" SET DATA TYPE numeric(12, 2) USING round("price"::numeric, 2);--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "totalAmount" SET DATA TYPE numeric(12, 2) USING round("totalAmount"::numeric, 2);--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "amountPaid" SET DATA TYPE numeric(12, 2) USING round("amountPaid"::numeric, 2);--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "amountPaid" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ProductVariant" ALTER COLUMN "price" SET DATA TYPE numeric(12, 2) USING round("price"::numeric, 2);--> statement-breakpoint
ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "processedAt" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "WebhookEvent_receivedAt_idx" ON "WebhookEvent" USING btree ("receivedAt");
