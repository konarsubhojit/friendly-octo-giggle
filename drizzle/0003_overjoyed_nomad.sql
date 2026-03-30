ALTER TABLE "ProductVariation" RENAME COLUMN "priceModifier" TO "price";--> statement-breakpoint
ALTER TABLE "ProductVariation" ADD COLUMN "variationType" text DEFAULT 'styling' NOT NULL;--> statement-breakpoint
-- Backfill: old priceModifier was a delta; convert to absolute price using parent product price
UPDATE "ProductVariation" v
SET "price" = p."price" + v."price"
FROM "Product" p
WHERE v."productId" = p.id;--> statement-breakpoint
-- Remove the inherited DEFAULT 0 so new rows must always supply an explicit price
ALTER TABLE "ProductVariation" ALTER COLUMN "price" DROP DEFAULT;