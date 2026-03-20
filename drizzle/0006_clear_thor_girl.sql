CREATE INDEX "Order_status_idx" ON "Order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Order_createdAt_idx" ON "Order" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Product_createdAt_idx" ON "Product" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Product_deletedAt_idx" ON "Product" USING btree ("deletedAt");