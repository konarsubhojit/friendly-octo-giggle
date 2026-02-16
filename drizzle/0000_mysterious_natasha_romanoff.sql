CREATE TYPE "public"."OrderStatus" AS ENUM('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('CUSTOMER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "CartItem" (
	"id" text PRIMARY KEY NOT NULL,
	"cartId" text NOT NULL,
	"productId" text NOT NULL,
	"variationId" text,
	"quantity" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "CartItem_cartId_productId_variationId_key" UNIQUE("cartId","productId","variationId")
);
--> statement-breakpoint
CREATE TABLE "Cart" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"sessionId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Cart_userId_unique" UNIQUE("userId"),
	CONSTRAINT "Cart_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "OrderItem" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"productId" text NOT NULL,
	"variationId" text,
	"quantity" integer NOT NULL,
	"price" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Order" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"customerAddress" text NOT NULL,
	"totalAmount" double precision NOT NULL,
	"status" "OrderStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductVariation" (
	"id" text PRIMARY KEY NOT NULL,
	"productId" text NOT NULL,
	"name" text NOT NULL,
	"designName" text NOT NULL,
	"image" text,
	"priceModifier" double precision DEFAULT 0 NOT NULL,
	"stock" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductVariation_productId_name_key" UNIQUE("productId","name")
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" double precision NOT NULL,
	"image" text NOT NULL,
	"stock" integer NOT NULL,
	"category" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"role" "UserRole" DEFAULT 'CUSTOMER' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "VerificationToken_token_unique" UNIQUE("token"),
	CONSTRAINT "VerificationToken_identifier_token_key" UNIQUE("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variationId_ProductVariation_id_fk" FOREIGN KEY ("variationId") REFERENCES "public"."ProductVariation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variationId_ProductVariation_id_fk" FOREIGN KEY ("variationId") REFERENCES "public"."ProductVariation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariation" ADD CONSTRAINT "ProductVariation_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "CartItem_cartId_idx" ON "CartItem" USING btree ("cartId");--> statement-breakpoint
CREATE INDEX "CartItem_productId_idx" ON "CartItem" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "CartItem_variationId_idx" ON "CartItem" USING btree ("variationId");--> statement-breakpoint
CREATE INDEX "Cart_sessionId_idx" ON "Cart" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "OrderItem_variationId_idx" ON "OrderItem" USING btree ("variationId");--> statement-breakpoint
CREATE INDEX "Order_userId_idx" ON "Order" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ProductVariation_productId_idx" ON "ProductVariation" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "Product_category_idx" ON "Product" USING btree ("category");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId");