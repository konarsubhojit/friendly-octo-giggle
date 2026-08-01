CREATE TABLE "NotificationPreference" (
	"userId" text PRIMARY KEY NOT NULL,
	"transactionalEmail" boolean DEFAULT true NOT NULL,
	"transactionalPush" boolean DEFAULT false NOT NULL,
	"transactionalSms" boolean DEFAULT false NOT NULL,
	"marketingEmail" boolean DEFAULT false NOT NULL,
	"marketingPush" boolean DEFAULT false NOT NULL,
	"marketingSms" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PushSubscription" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PushSubscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription" USING btree ("userId");