ALTER TABLE "OrderItem" ALTER COLUMN "orderId" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "id" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "Review" ALTER COLUMN "orderId" SET DATA TYPE varchar(10);