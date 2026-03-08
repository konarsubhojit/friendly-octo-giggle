ALTER TABLE "CartItem" ALTER COLUMN "id" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "CartItem" ALTER COLUMN "cartId" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "CartItem" ALTER COLUMN "productId" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "CartItem" ALTER COLUMN "variationId" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "Cart" ALTER COLUMN "id" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "OrderItem" ALTER COLUMN "id" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "OrderItem" ALTER COLUMN "orderId" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "OrderItem" ALTER COLUMN "productId" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "OrderItem" ALTER COLUMN "variationId" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "id" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "ProductVariation" ALTER COLUMN "id" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "ProductVariation" ALTER COLUMN "productId" SET DATA TYPE varchar(7);--> statement-breakpoint
ALTER TABLE "Product" ALTER COLUMN "id" SET DATA TYPE varchar(7);