CREATE TABLE "Address" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"label" text NOT NULL,
	"addressLine1" text NOT NULL,
	"addressLine2" text,
	"addressLine3" text,
	"pinCode" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Address_userId_idx" ON "Address" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Address_one_default_per_user_idx" ON "Address" USING btree ("userId") WHERE "Address"."isDefault" = true;