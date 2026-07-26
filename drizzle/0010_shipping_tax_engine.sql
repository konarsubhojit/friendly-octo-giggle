CREATE TYPE "public"."ShippingMethod" AS ENUM('STANDARD', 'EXPRESS');--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD COLUMN "shippingMethod" "ShippingMethod";--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "subtotalAmount" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "shippingAmount" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "taxAmount" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "shippingMethod" "ShippingMethod";--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD COLUMN "weightGrams" integer;--> statement-breakpoint
-- Existing orders predate the shipping/tax engine: their captured total was
-- purely merchandise, so backfill the subtotal to keep totals reconcilable.
UPDATE "Order" SET "subtotalAmount" = "totalAmount" WHERE "subtotalAmount" = 0;
