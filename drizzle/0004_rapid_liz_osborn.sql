CREATE TABLE "PasswordHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"passwordHash" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "passwordHash" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "phoneNumber" varchar(20);--> statement-breakpoint
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_phoneNumber_unique" UNIQUE("phoneNumber");