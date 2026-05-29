ALTER TABLE "Product" ADD COLUMN "localizedContent" json DEFAULT '{}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "localePreference" varchar(10) DEFAULT 'en' NOT NULL;