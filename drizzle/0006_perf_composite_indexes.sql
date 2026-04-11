CREATE INDEX IF NOT EXISTS "Review_productId_rating_idx" ON "Review" ("productId","rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "FailedEmail_recipientEmail_status_idx" ON "FailedEmail" ("recipientEmail","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "FailedEmail_status_isRetriable_createdAt_idx" ON "FailedEmail" ("status","isRetriable","createdAt");
