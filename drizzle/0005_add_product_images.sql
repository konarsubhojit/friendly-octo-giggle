ALTER TABLE "Product" ADD COLUMN "images" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "ProductVariation" ADD COLUMN "images" json DEFAULT '[]'::json NOT NULL;
