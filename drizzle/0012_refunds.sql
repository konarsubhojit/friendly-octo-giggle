CREATE TYPE "public"."RefundStatus" AS ENUM('PENDING', 'PROCESSED', 'FAILED');--> statement-breakpoint
ALTER TYPE "public"."EmailType" ADD VALUE 'order_refund_update';--> statement-breakpoint
CREATE TABLE "Refund" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"orderId" varchar(10) NOT NULL,
	"provider" "PaymentProvider" NOT NULL,
	"paymentTransactionId" text NOT NULL,
	"gatewayRefundId" text,
	"amount" numeric(12, 2) NOT NULL,
	"status" "RefundStatus" DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"errorMessage" text,
	"initiatedById" text,
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "stockRestoredAt" timestamp;--> statement-breakpoint
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_User_id_fk" FOREIGN KEY ("initiatedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Refund_orderId_idx" ON "Refund" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "Refund_status_idx" ON "Refund" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Refund_createdAt_idx" ON "Refund" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Refund_gatewayRefundId_key" ON "Refund" USING btree ("gatewayRefundId");