CREATE TABLE "AdminAuditLog" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"entity" text NOT NULL,
	"entityId" text NOT NULL,
	"action" text NOT NULL,
	"diff" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AdminAuditLog_userId_idx" ON "AdminAuditLog" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "AdminAuditLog_entity_idx" ON "AdminAuditLog" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog" USING btree ("createdAt");