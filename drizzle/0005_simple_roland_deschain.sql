ALTER TABLE "CheckoutRequest" DROP CONSTRAINT "CheckoutRequest_paymentTransactionId_key";--> statement-breakpoint
CREATE UNIQUE INDEX "CheckoutRequest_paymentTransactionId_key" ON "CheckoutRequest" USING btree ("paymentTransactionId");--> statement-breakpoint
ALTER TABLE "Product" DROP COLUMN "localizedContent";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN "localePreference";