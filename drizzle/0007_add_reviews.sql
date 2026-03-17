CREATE TABLE "Review" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"productId" varchar(7) NOT NULL,
	"orderId" varchar(7),
	"userId" text,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"isAnonymous" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "Review_productId_idx" ON "Review" USING btree ("productId");
--> statement-breakpoint
CREATE INDEX "Review_userId_idx" ON "Review" USING btree ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review" USING btree ("userId","productId");
