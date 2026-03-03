ALTER TABLE "OrderItem" ADD COLUMN "customizationNote" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "trackingNumber" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "shippingProvider" text;