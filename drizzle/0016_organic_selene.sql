CREATE TABLE "ProductAffinityScore" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"anchorProductId" varchar(7) NOT NULL,
	"recommendedProductId" varchar(7) NOT NULL,
	"score" double precision NOT NULL,
	"support" integer NOT NULL,
	"source" text DEFAULT 'combined' NOT NULL,
	"computedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductAffinityScore_anchor_recommended_key" UNIQUE("anchorProductId","recommendedProductId"),
	CONSTRAINT "ProductAffinityScore_no_self_reference" CHECK ("ProductAffinityScore"."anchorProductId" <> "ProductAffinityScore"."recommendedProductId"),
	CONSTRAINT "ProductAffinityScore_support_positive" CHECK ("ProductAffinityScore"."support" >= 1)
);
--> statement-breakpoint
ALTER TABLE "ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_anchorProductId_Product_id_fk" FOREIGN KEY ("anchorProductId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_recommendedProductId_Product_id_fk" FOREIGN KEY ("recommendedProductId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ProductAffinityScore_anchor_score_idx" ON "ProductAffinityScore" USING btree ("anchorProductId","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ProductAffinityScore_recommendedProductId_idx" ON "ProductAffinityScore" USING btree ("recommendedProductId");--> statement-breakpoint
CREATE INDEX "ProductAffinityScore_computedAt_idx" ON "ProductAffinityScore" USING btree ("computedAt");