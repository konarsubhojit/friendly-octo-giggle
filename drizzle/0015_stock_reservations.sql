CREATE TYPE "public"."StockReservationStatus" AS ENUM('HELD', 'CONSUMED', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "StockReservation" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"checkoutRequestId" varchar(7) NOT NULL,
	"variantId" varchar(7) NOT NULL,
	"quantity" integer NOT NULL,
	"status" "StockReservationStatus" DEFAULT 'HELD' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"settledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "StockReservation_checkoutRequestId_variantId_key" UNIQUE("checkoutRequestId","variantId"),
	CONSTRAINT "StockReservation_quantity_positive" CHECK ("StockReservation"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD COLUMN "reservedStock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES "public"."CheckoutRequest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "StockReservation_status_expiresAt_idx" ON "StockReservation" USING btree ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "StockReservation_variantId_status_idx" ON "StockReservation" USING btree ("variantId","status");--> statement-breakpoint
CREATE INDEX "StockReservation_checkoutRequestId_idx" ON "StockReservation" USING btree ("checkoutRequestId");--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_reservedStock_non_negative" CHECK ("ProductVariant"."reservedStock" >= 0);