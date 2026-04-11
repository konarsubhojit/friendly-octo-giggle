CREATE INDEX "OrderItem_productId_orderId_idx" ON "OrderItem" ("productId","orderId");--> statement-breakpoint
CREATE INDEX "Product_active_createdAt_idx" ON "Product" ("createdAt" DESC) WHERE "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "Order_userId_createdAt_idx" ON "Order" ("userId","createdAt" DESC);
