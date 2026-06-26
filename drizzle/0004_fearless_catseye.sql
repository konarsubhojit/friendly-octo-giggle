CREATE TYPE "public"."PaymentProvider" AS ENUM('RAZORPAY');--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED');--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "paymentProvider" "PaymentProvider";--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "paymentOrderId" text;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "paymentTransactionId" text;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "paymentSignature" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "paymentStatus" "PaymentStatus" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "paymentProvider" "PaymentProvider";--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "paymentOrderId" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "paymentTransactionId" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "amountPaid" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "paidAt" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "CheckoutRequest_paymentTransactionId_key" ON "CheckoutRequest" USING btree ("paymentTransactionId");--> statement-breakpoint
CREATE INDEX "Order_paymentStatus_idx" ON "Order" USING btree ("paymentStatus");--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentTransactionId_key" UNIQUE("paymentTransactionId");