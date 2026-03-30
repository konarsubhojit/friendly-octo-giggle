ALTER TABLE "ProductVariation" RENAME COLUMN "priceModifier" TO "price";--> statement-breakpoint
ALTER TABLE "ProductVariation" ADD COLUMN "variationType" text DEFAULT 'styling' NOT NULL;