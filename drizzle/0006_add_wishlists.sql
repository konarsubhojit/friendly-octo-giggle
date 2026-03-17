CREATE TABLE "Wishlist" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"productId" varchar(7) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist" USING btree ("userId","productId");
--> statement-breakpoint
CREATE INDEX "Wishlist_userId_idx" ON "Wishlist" USING btree ("userId");
