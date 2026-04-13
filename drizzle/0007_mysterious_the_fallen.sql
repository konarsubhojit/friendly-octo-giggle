ALTER TABLE "CheckoutRequest" ADD COLUMN "addressLine1" text;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "addressLine2" text;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "addressLine3" text;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "pinCode" text;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "addressLine1" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "addressLine2" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "addressLine3" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "pinCode" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "state" text;--> statement-breakpoint
CREATE INDEX "FailedEmail_recipientEmail_status_idx" ON "FailedEmail" USING btree ("recipientEmail","status");--> statement-breakpoint
CREATE INDEX "FailedEmail_status_isRetriable_createdAt_idx" ON "FailedEmail" USING btree ("status","isRetriable","createdAt");--> statement-breakpoint
CREATE INDEX "Review_productId_rating_idx" ON "Review" USING btree ("productId","rating");