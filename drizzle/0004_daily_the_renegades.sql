ALTER TABLE "ProductVariation" ADD COLUMN "styleId" varchar(7);--> statement-breakpoint
CREATE INDEX "ProductVariation_styleId_idx" ON "ProductVariation" USING btree ("styleId");