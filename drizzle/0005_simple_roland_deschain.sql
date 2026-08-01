ALTER TABLE "CheckoutRequest" DROP CONSTRAINT IF EXISTS "CheckoutRequest_paymentTransactionId_key";--> statement-breakpoint
DROP INDEX IF EXISTS "CheckoutRequest_paymentTransactionId_key";--> statement-breakpoint
CREATE UNIQUE INDEX "CheckoutRequest_paymentTransactionId_key" ON "CheckoutRequest" USING btree ("paymentTransactionId");--> statement-breakpoint
ALTER TABLE "Product" DROP COLUMN IF EXISTS "localizedContent";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "localePreference";
