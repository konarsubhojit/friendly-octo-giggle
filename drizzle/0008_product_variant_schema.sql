CREATE TABLE "ProductOptionValue" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"optionId" varchar(7) NOT NULL,
	"value" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductOptionValue_optionId_value_key" UNIQUE("optionId","value")
);
--> statement-breakpoint
CREATE TABLE "ProductOption" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"productId" varchar(7) NOT NULL,
	"name" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductOption_productId_name_key" UNIQUE("productId","name")
);
--> statement-breakpoint
CREATE TABLE "ProductVariantOptionValue" (
	"variantId" varchar(7) NOT NULL,
	"optionValueId" varchar(7) NOT NULL,
	CONSTRAINT "ProductVariantOptionValue_pk" UNIQUE("variantId","optionValueId")
);
--> statement-breakpoint
ALTER TABLE "ProductVariation" RENAME TO "ProductVariant";--> statement-breakpoint
ALTER TABLE "CartItem" RENAME COLUMN "variationId" TO "variantId";--> statement-breakpoint
ALTER TABLE "OrderItem" RENAME COLUMN "variationId" TO "variantId";--> statement-breakpoint
ALTER TABLE "ProductShare" RENAME COLUMN "variationId" TO "variantId";--> statement-breakpoint
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_cartId_productId_variationId_key";--> statement-breakpoint
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariation_productId_name_key";--> statement-breakpoint
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_variationId_ProductVariation_id_fk";
--> statement-breakpoint
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_variationId_ProductVariation_id_fk";
--> statement-breakpoint
ALTER TABLE "ProductShare" DROP CONSTRAINT "ProductShare_variationId_ProductVariation_id_fk";
--> statement-breakpoint
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariation_productId_Product_id_fk";
--> statement-breakpoint
DROP INDEX "CartItem_variationId_idx";--> statement-breakpoint
DROP INDEX "OrderItem_variationId_idx";--> statement-breakpoint
DROP INDEX "ProductShare_variationId_idx";--> statement-breakpoint
DROP INDEX "ProductVariation_productId_idx";--> statement-breakpoint
DROP INDEX "ProductVariation_styleId_idx";--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_ProductOption_id_fk" FOREIGN KEY ("optionId") REFERENCES "public"."ProductOption"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionValueId_ProductOptionValue_id_fk" FOREIGN KEY ("optionValueId") REFERENCES "public"."ProductOptionValue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ProductOptionValue_optionId_idx" ON "ProductOptionValue" USING btree ("optionId");--> statement-breakpoint
CREATE INDEX "ProductOption_productId_idx" ON "ProductOption" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "ProductVariantOptionValue_variantId_idx" ON "ProductVariantOptionValue" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "ProductVariantOptionValue_optionValueId_idx" ON "ProductVariantOptionValue" USING btree ("optionValueId");--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductShare" ADD CONSTRAINT "ProductShare_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "CartItem_variantId_idx" ON "CartItem" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "ProductShare_variantId_idx" ON "ProductShare" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "ProductVariant_deletedAt_idx" ON "ProductVariant" USING btree ("deletedAt");--> statement-breakpoint
ALTER TABLE "ProductVariant" DROP COLUMN "styleId";--> statement-breakpoint
ALTER TABLE "ProductVariant" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "ProductVariant" DROP COLUMN "designName";--> statement-breakpoint
ALTER TABLE "ProductVariant" DROP COLUMN "variationType";--> statement-breakpoint
-- Data migration: remove cart items that have no variant assigned (legacy nullable rows)
DELETE FROM "CartItem" WHERE "variantId" IS NULL;--> statement-breakpoint
-- Data migration: remove order items that have no variant assigned (legacy nullable rows)
DELETE FROM "OrderItem" WHERE "variantId" IS NULL;--> statement-breakpoint
-- Enforce NOT NULL on CartItem.variantId (was previously nullable as variationId)
ALTER TABLE "CartItem" ALTER COLUMN "variantId" SET NOT NULL;--> statement-breakpoint
-- Enforce NOT NULL on OrderItem.variantId (was previously nullable as variationId)
ALTER TABLE "OrderItem" ALTER COLUMN "variantId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Product" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "Product" DROP COLUMN "stock";--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_productId_variantId_key" UNIQUE("cartId","productId","variantId");