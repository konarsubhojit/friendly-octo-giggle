CREATE TABLE "ProductShare" (
	"key" varchar(7) PRIMARY KEY NOT NULL,
	"productId" varchar(7) NOT NULL,
	"variationId" varchar(7),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ProductShare" ADD CONSTRAINT "ProductShare_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ProductShare" ADD CONSTRAINT "ProductShare_variationId_ProductVariation_id_fk" FOREIGN KEY ("variationId") REFERENCES "public"."ProductVariation"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ProductShare_productId_idx" ON "ProductShare" USING btree ("productId");
--> statement-breakpoint
CREATE INDEX "ProductShare_variationId_idx" ON "ProductShare" USING btree ("variationId");
