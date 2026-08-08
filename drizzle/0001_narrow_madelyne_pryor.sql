CREATE TYPE "public"."ReturnReason" AS ENUM('DAMAGED', 'DEFECTIVE', 'WRONG_ITEM');--> statement-breakpoint
CREATE TYPE "public"."ReturnStatus" AS ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED');--> statement-breakpoint
ALTER TYPE "public"."EmailType" ADD VALUE 'return_status_update' BEFORE 'abandoned_cart_reminder';--> statement-breakpoint
CREATE TABLE "ReturnEvidence" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"returnRequestId" varchar(7),
	"userId" text NOT NULL,
	"orderId" varchar(10) NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"contentType" text,
	"provider" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ReturnItem" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"returnRequestId" varchar(7) NOT NULL,
	"orderItemId" varchar(7) NOT NULL,
	"variantId" varchar(7) NOT NULL,
	"quantity" integer NOT NULL,
	"refundableAmount" numeric(12, 2) NOT NULL,
	CONSTRAINT "ReturnItem_quantity_positive" CHECK ("ReturnItem"."quantity" > 0),
	CONSTRAINT "ReturnItem_refundableAmount_non_negative" CHECK ("ReturnItem"."refundableAmount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ReturnRequest" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"orderId" varchar(10) NOT NULL,
	"userId" text NOT NULL,
	"status" "ReturnStatus" DEFAULT 'REQUESTED' NOT NULL,
	"reason" "ReturnReason" NOT NULL,
	"customerNote" text,
	"decisionReason" text,
	"decidedById" text,
	"decidedAt" timestamp,
	"receivedById" text,
	"receivedAt" timestamp,
	"stockRestoredAt" timestamp,
	"refundId" varchar(7),
	"refundAmount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ReturnRequest_refundAmount_non_negative" CHECK ("ReturnRequest"."refundAmount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "Refund" ALTER COLUMN "paymentTransactionId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "deliveredAt" timestamp;--> statement-breakpoint
ALTER TABLE "Refund" ADD COLUMN "returnRequestId" varchar(7);--> statement-breakpoint
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_returnRequestId_ReturnRequest_id_fk" FOREIGN KEY ("returnRequestId") REFERENCES "public"."ReturnRequest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnRequestId_ReturnRequest_id_fk" FOREIGN KEY ("returnRequestId") REFERENCES "public"."ReturnRequest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_OrderItem_id_fk" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_decidedById_User_id_fk" FOREIGN KEY ("decidedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_receivedById_User_id_fk" FOREIGN KEY ("receivedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_refundId_Refund_id_fk" FOREIGN KEY ("refundId") REFERENCES "public"."Refund"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ReturnEvidence_returnRequestId_idx" ON "ReturnEvidence" USING btree ("returnRequestId");--> statement-breakpoint
CREATE INDEX "ReturnEvidence_userId_orderId_idx" ON "ReturnEvidence" USING btree ("userId","orderId");--> statement-breakpoint
CREATE INDEX "ReturnItem_returnRequestId_idx" ON "ReturnItem" USING btree ("returnRequestId");--> statement-breakpoint
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem" USING btree ("orderItemId");--> statement-breakpoint
CREATE UNIQUE INDEX "ReturnItem_returnRequestId_orderItemId_key" ON "ReturnItem" USING btree ("returnRequestId","orderItemId");--> statement-breakpoint
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "ReturnRequest_userId_idx" ON "ReturnRequest" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest" USING btree ("status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "ReturnRequest_refundId_key" ON "ReturnRequest" USING btree ("refundId");--> statement-breakpoint
CREATE INDEX "Order_deliveredAt_idx" ON "Order" USING btree ("deliveredAt");--> statement-breakpoint
CREATE INDEX "Refund_returnRequestId_idx" ON "Refund" USING btree ("returnRequestId");--> statement-breakpoint
-- One live refund per return. The refund path sends money and writes
-- ReturnRequest.refundId in two separate transactions, because an external
-- gateway call must not happen while a row lock is held. If the process dies
-- between them the money is gone but refundId is still null, leaving the return
-- retryable — and the retry would pay the customer twice without this.
-- FAILED is excluded so a genuinely rejected attempt can still be retried.
CREATE UNIQUE INDEX "Refund_returnRequestId_live_key" ON "Refund" ("returnRequestId") WHERE "returnRequestId" IS NOT NULL AND "status" <> 'FAILED';--> statement-breakpoint
-- Backfill: eligibility hard-requires deliveredAt, so without this every order
-- already in DELIVERED would report NOT_DELIVERED to its customer forever.
-- DELIVERED is terminal, so no later transition can stamp it.
UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED' AND "deliveredAt" IS NULL;