CREATE TYPE "public"."CheckoutRequestStatus" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "CheckoutRequest" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"customerAddress" text NOT NULL,
	"items" json NOT NULL,
	"status" "CheckoutRequestStatus" DEFAULT 'PENDING' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "checkoutRequestId" varchar(7);--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD CONSTRAINT "CheckoutRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "CheckoutRequest_userId_idx" ON "CheckoutRequest" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "CheckoutRequest_status_idx" ON "CheckoutRequest" USING btree ("status");--> statement-breakpoint
CREATE INDEX "CheckoutRequest_createdAt_idx" ON "CheckoutRequest" USING btree ("createdAt");--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES "public"."CheckoutRequest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutRequestId_key" UNIQUE("checkoutRequestId");