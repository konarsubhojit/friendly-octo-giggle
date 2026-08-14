CREATE TABLE "AdminSavedView" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"ownerId" text,
	"resource" text NOT NULL,
	"name" text NOT NULL,
	"criteria" json NOT NULL,
	"isBuiltIn" boolean DEFAULT false NOT NULL,
	"requiredPermission" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AdminSavedView" ADD CONSTRAINT "AdminSavedView_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AdminSavedView_ownerId_resource_idx" ON "AdminSavedView" USING btree ("ownerId","resource");--> statement-breakpoint
CREATE INDEX "AdminSavedView_resource_isBuiltIn_idx" ON "AdminSavedView" USING btree ("resource","isBuiltIn");--> statement-breakpoint
CREATE INDEX "AdminAuditLog_entity_entityId_createdAt_idx" ON "AdminAuditLog" USING btree ("entity","entityId","createdAt");--> statement-breakpoint
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog" USING btree ("action","createdAt");