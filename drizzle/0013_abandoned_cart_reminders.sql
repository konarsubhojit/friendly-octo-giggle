ALTER TYPE "public"."EmailType" ADD VALUE 'abandoned_cart_reminder';--> statement-breakpoint
CREATE TABLE "AbandonedCartReminder" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"cartId" varchar(7) NOT NULL,
	"userId" text NOT NULL,
	"reminderNumber" integer NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AbandonedCartReminder" ADD CONSTRAINT "AbandonedCartReminder_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AbandonedCartReminder" ADD CONSTRAINT "AbandonedCartReminder_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "AbandonedCartReminder_cartId_reminderNumber_key" ON "AbandonedCartReminder" USING btree ("cartId","reminderNumber");--> statement-breakpoint
CREATE INDEX "AbandonedCartReminder_cartId_idx" ON "AbandonedCartReminder" USING btree ("cartId");--> statement-breakpoint
CREATE INDEX "AbandonedCartReminder_userId_idx" ON "AbandonedCartReminder" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "AbandonedCartReminder_sentAt_idx" ON "AbandonedCartReminder" USING btree ("sentAt");
