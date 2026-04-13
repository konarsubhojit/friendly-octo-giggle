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
ALTER TABLE "Order" ADD COLUMN "state" text;