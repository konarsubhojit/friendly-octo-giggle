CREATE TYPE "public"."CheckoutRequestStatus" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."DiscountType" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BOGO');--> statement-breakpoint
CREATE TYPE "public"."EmailType" AS ENUM('order_confirmation', 'order_status_update', 'order_refund_update', 'abandoned_cart_reminder');--> statement-breakpoint
CREATE TYPE "public"."FailedEmailStatus" AS ENUM('pending', 'failed', 'sent');--> statement-breakpoint
CREATE TYPE "public"."OrderStatus" AS ENUM('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."PaymentProvider" AS ENUM('RAZORPAY', 'COD');--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."RefundStatus" AS ENUM('PENDING', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."ShippingMethod" AS ENUM('STANDARD', 'EXPRESS');--> statement-breakpoint
CREATE TYPE "public"."StockReservationStatus" AS ENUM('HELD', 'CONSUMED', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('CUSTOMER', 'ADMIN', 'SUPPORT', 'FULFILMENT');--> statement-breakpoint
CREATE TABLE "AbandonedCartReminder" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"cartId" varchar(7) NOT NULL,
	"userId" text NOT NULL,
	"reminderNumber" integer NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "AbandonedCartReminder_cartId_reminderNumber_key" UNIQUE("cartId","reminderNumber")
);
--> statement-breakpoint
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
CREATE TABLE "Address" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"label" text NOT NULL,
	"addressLine1" text NOT NULL,
	"addressLine2" text,
	"addressLine3" text,
	"pinCode" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AdminAuditLog" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"role" "UserRole",
	"entity" text NOT NULL,
	"entityId" text NOT NULL,
	"action" text NOT NULL,
	"diff" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CartItem" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"cartId" varchar(7) NOT NULL,
	"productId" varchar(7) NOT NULL,
	"variantId" varchar(7) NOT NULL,
	"quantity" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "CartItem_cartId_productId_variantId_key" UNIQUE("cartId","productId","variantId")
);
--> statement-breakpoint
CREATE TABLE "Cart" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text,
	"sessionId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Cart_userId_unique" UNIQUE("userId"),
	CONSTRAINT "Cart_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "Category" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "Category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "CheckoutRequest" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"customerAddress" text NOT NULL,
	"addressLine1" text,
	"addressLine2" text,
	"addressLine3" text,
	"pinCode" text,
	"city" text,
	"state" text,
	"items" json NOT NULL,
	"couponCode" text,
	"shippingMethod" "ShippingMethod",
	"paymentProvider" "PaymentProvider",
	"paymentOrderId" text,
	"paymentTransactionId" text,
	"paymentSignature" text,
	"status" "CheckoutRequestStatus" DEFAULT 'PENDING' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CouponRedemption" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"couponId" varchar(7) NOT NULL,
	"userId" text,
	"orderId" varchar(10) NOT NULL,
	"discountAmount" numeric(12, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "CouponRedemption_couponId_orderId_key" UNIQUE("couponId","orderId")
);
--> statement-breakpoint
CREATE TABLE "Coupon" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discountType" "DiscountType" NOT NULL,
	"discountValue" numeric(12, 2) DEFAULT 0 NOT NULL,
	"maxDiscountAmount" numeric(12, 2),
	"minCartValue" numeric(12, 2) DEFAULT 0 NOT NULL,
	"scopedCategories" json DEFAULT '[]'::json NOT NULL,
	"scopedProductIds" json DEFAULT '[]'::json NOT NULL,
	"usageLimit" integer,
	"perUserLimit" integer,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"stackable" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startsAt" timestamp,
	"endsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Coupon_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "FailedEmail" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"recipientEmail" text NOT NULL,
	"subject" text NOT NULL,
	"bodyHtml" text NOT NULL,
	"bodyText" text NOT NULL,
	"emailType" "EmailType" NOT NULL,
	"referenceId" varchar(7) NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"isRetriable" boolean DEFAULT true NOT NULL,
	"status" "FailedEmailStatus" DEFAULT 'pending' NOT NULL,
	"errorHistory" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastAttemptedAt" timestamp,
	"sentAt" timestamp
);
--> statement-breakpoint
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
CREATE TABLE "OrderItem" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"orderId" varchar(10) NOT NULL,
	"productId" varchar(7) NOT NULL,
	"variantId" varchar(7) NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"customizationNote" text
);
--> statement-breakpoint
CREATE TABLE "Order" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"userId" text,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"customerAddress" text NOT NULL,
	"addressLine1" text,
	"addressLine2" text,
	"addressLine3" text,
	"pinCode" text,
	"city" text,
	"state" text,
	"checkoutRequestId" varchar(7),
	"subtotalAmount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"shippingAmount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"taxAmount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"shippingMethod" "ShippingMethod",
	"totalAmount" numeric(12, 2) NOT NULL,
	"discountAmount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"couponId" varchar(7),
	"couponCode" text,
	"paymentStatus" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"paymentProvider" "PaymentProvider",
	"paymentOrderId" text,
	"paymentTransactionId" text,
	"amountPaid" numeric(12, 2) DEFAULT 0 NOT NULL,
	"paidAt" timestamp,
	"status" "OrderStatus" DEFAULT 'PENDING' NOT NULL,
	"stockRestoredAt" timestamp,
	"trackingNumber" text,
	"shippingProvider" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Order_paymentTransactionId_key" UNIQUE("paymentTransactionId"),
	CONSTRAINT "Order_checkoutRequestId_key" UNIQUE("checkoutRequestId")
);
--> statement-breakpoint
CREATE TABLE "PasswordHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"passwordHash" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductAffinityScore" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"anchorProductId" varchar(7) NOT NULL,
	"recommendedProductId" varchar(7) NOT NULL,
	"score" double precision NOT NULL,
	"support" integer NOT NULL,
	"source" text DEFAULT 'combined' NOT NULL,
	"computedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductAffinityScore_anchor_recommended_key" UNIQUE("anchorProductId","recommendedProductId"),
	CONSTRAINT "ProductAffinityScore_no_self_reference" CHECK ("ProductAffinityScore"."anchorProductId" <> "ProductAffinityScore"."recommendedProductId"),
	CONSTRAINT "ProductAffinityScore_support_positive" CHECK ("ProductAffinityScore"."support" >= 1)
);
--> statement-breakpoint
CREATE TABLE "ProductOptionValue" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"optionId" varchar(7) NOT NULL,
	"value" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductOptionValue_optionId_value_key" UNIQUE("optionId","value")
);
--> statement-breakpoint
CREATE TABLE "ProductOption" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"productId" varchar(7) NOT NULL,
	"name" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductOption_productId_name_key" UNIQUE("productId","name")
);
--> statement-breakpoint
CREATE TABLE "ProductShare" (
	"key" varchar(7) PRIMARY KEY NOT NULL,
	"productId" varchar(7) NOT NULL,
	"variantId" varchar(7),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductVariantOptionValue" (
	"variantId" varchar(7) NOT NULL,
	"optionValueId" varchar(7) NOT NULL,
	CONSTRAINT "ProductVariantOptionValue_pk" PRIMARY KEY("variantId","optionValueId")
);
--> statement-breakpoint
CREATE TABLE "ProductVariant" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"productId" varchar(7) NOT NULL,
	"sku" text,
	"price" numeric(12, 2) NOT NULL,
	"stock" integer NOT NULL,
	"reservedStock" integer DEFAULT 0 NOT NULL,
	"weightGrams" integer,
	"image" text,
	"images" json DEFAULT '[]'::json NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductVariant_reservedStock_non_negative" CHECK ("ProductVariant"."reservedStock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"image" text NOT NULL,
	"images" json DEFAULT '[]'::json NOT NULL,
	"category" text NOT NULL,
	"deletedAt" timestamp,
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
CREATE TABLE "Refund" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"orderId" varchar(10) NOT NULL,
	"provider" "PaymentProvider" NOT NULL,
	"paymentTransactionId" text NOT NULL,
	"gatewayRefundId" text,
	"amount" numeric(12, 2) NOT NULL,
	"status" "RefundStatus" DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"errorMessage" text,
	"initiatedById" text,
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ReviewVote" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"reviewId" varchar(7) NOT NULL,
	"userId" text NOT NULL,
	"vote" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ReviewVote_reviewId_userId_key" UNIQUE("reviewId","userId")
);
--> statement-breakpoint
CREATE TABLE "Review" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"productId" varchar(7) NOT NULL,
	"orderId" varchar(10),
	"userId" text,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"isAnonymous" boolean DEFAULT false NOT NULL,
	"isVerifiedBuyer" boolean DEFAULT false NOT NULL,
	"helpfulCount" integer DEFAULT 0 NOT NULL,
	"notHelpfulCount" integer DEFAULT 0 NOT NULL,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"isHidden" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Review_userId_productId_key" UNIQUE("userId","productId")
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StockReservation" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"checkoutRequestId" varchar(7) NOT NULL,
	"variantId" varchar(7) NOT NULL,
	"quantity" integer NOT NULL,
	"status" "StockReservationStatus" DEFAULT 'HELD' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"settledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "StockReservation_checkoutRequestId_variantId_key" UNIQUE("checkoutRequestId","variantId"),
	CONSTRAINT "StockReservation_quantity_positive" CHECK ("StockReservation"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"passwordHash" text,
	"phoneNumber" varchar(20),
	"currencyPreference" varchar(3) DEFAULT 'INR' NOT NULL,
	"role" "UserRole" DEFAULT 'CUSTOMER' NOT NULL,
	"lockedUntil" timestamp,
	"sessionVersion" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_phoneNumber_unique" UNIQUE("phoneNumber")
);
--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "VerificationToken_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "VerificationToken_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "WebhookEvent" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"provider" "PaymentProvider" NOT NULL,
	"eventId" text NOT NULL,
	"eventType" text NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	CONSTRAINT "WebhookEvent_provider_eventId_key" UNIQUE("provider","eventId")
);
--> statement-breakpoint
CREATE TABLE "Wishlist" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"productId" varchar(7) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Wishlist_userId_productId_key" UNIQUE("userId","productId")
);
--> statement-breakpoint
ALTER TABLE "AbandonedCartReminder" ADD CONSTRAINT "AbandonedCartReminder_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AbandonedCartReminder" ADD CONSTRAINT "AbandonedCartReminder_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CheckoutRequest" ADD CONSTRAINT "CheckoutRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_Coupon_id_fk" FOREIGN KEY ("couponId") REFERENCES "public"."Coupon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES "public"."CheckoutRequest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_Coupon_id_fk" FOREIGN KEY ("couponId") REFERENCES "public"."Coupon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_anchorProductId_Product_id_fk" FOREIGN KEY ("anchorProductId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_recommendedProductId_Product_id_fk" FOREIGN KEY ("recommendedProductId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_ProductOption_id_fk" FOREIGN KEY ("optionId") REFERENCES "public"."ProductOption"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductShare" ADD CONSTRAINT "ProductShare_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductShare" ADD CONSTRAINT "ProductShare_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionValueId_ProductOptionValue_id_fk" FOREIGN KEY ("optionValueId") REFERENCES "public"."ProductOptionValue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_User_id_fk" FOREIGN KEY ("initiatedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_Review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES "public"."CheckoutRequest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AbandonedCartReminder_cartId_idx" ON "AbandonedCartReminder" USING btree ("cartId");--> statement-breakpoint
CREATE INDEX "AbandonedCartReminder_userId_idx" ON "AbandonedCartReminder" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "AbandonedCartReminder_sentAt_idx" ON "AbandonedCartReminder" USING btree ("sentAt");--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Address_userId_idx" ON "Address" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Address_one_default_per_user_idx" ON "Address" USING btree ("userId") WHERE "Address"."isDefault" = true;--> statement-breakpoint
CREATE INDEX "AdminAuditLog_userId_idx" ON "AdminAuditLog" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "AdminAuditLog_entity_idx" ON "AdminAuditLog" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "CartItem_cartId_idx" ON "CartItem" USING btree ("cartId");--> statement-breakpoint
CREATE INDEX "CartItem_productId_idx" ON "CartItem" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "CartItem_variantId_idx" ON "CartItem" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "Cart_sessionId_idx" ON "Cart" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "CheckoutRequest_userId_idx" ON "CheckoutRequest" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "CheckoutRequest_status_idx" ON "CheckoutRequest" USING btree ("status");--> statement-breakpoint
CREATE INDEX "CheckoutRequest_createdAt_idx" ON "CheckoutRequest" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "CheckoutRequest_paymentTransactionId_key" ON "CheckoutRequest" USING btree ("paymentTransactionId");--> statement-breakpoint
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption" USING btree ("couponId");--> statement-breakpoint
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "CouponRedemption_createdAt_idx" ON "CouponRedemption" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Coupon_isActive_idx" ON "Coupon" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "Coupon_endsAt_idx" ON "Coupon" USING btree ("endsAt");--> statement-breakpoint
CREATE INDEX "FailedEmail_status_idx" ON "FailedEmail" USING btree ("status");--> statement-breakpoint
CREATE INDEX "FailedEmail_referenceId_idx" ON "FailedEmail" USING btree ("referenceId");--> statement-breakpoint
CREATE INDEX "FailedEmail_createdAt_idx" ON "FailedEmail" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "FailedEmail_recipientEmail_status_idx" ON "FailedEmail" USING btree ("recipientEmail","status");--> statement-breakpoint
CREATE INDEX "FailedEmail_status_isRetriable_createdAt_idx" ON "FailedEmail" USING btree ("status","isRetriable","createdAt");--> statement-breakpoint
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "Order_userId_idx" ON "Order" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Order_status_idx" ON "Order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Order_createdAt_idx" ON "Order" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Order_paymentStatus_idx" ON "Order" USING btree ("paymentStatus");--> statement-breakpoint
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ProductAffinityScore_anchor_score_idx" ON "ProductAffinityScore" USING btree ("anchorProductId","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ProductAffinityScore_recommendedProductId_idx" ON "ProductAffinityScore" USING btree ("recommendedProductId");--> statement-breakpoint
CREATE INDEX "ProductAffinityScore_computedAt_idx" ON "ProductAffinityScore" USING btree ("computedAt");--> statement-breakpoint
CREATE INDEX "ProductOptionValue_optionId_idx" ON "ProductOptionValue" USING btree ("optionId");--> statement-breakpoint
CREATE INDEX "ProductOption_productId_idx" ON "ProductOption" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "ProductShare_productId_idx" ON "ProductShare" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "ProductShare_variantId_idx" ON "ProductShare" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "ProductVariantOptionValue_variantId_idx" ON "ProductVariantOptionValue" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "ProductVariantOptionValue_optionValueId_idx" ON "ProductVariantOptionValue" USING btree ("optionValueId");--> statement-breakpoint
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "ProductVariant_deletedAt_idx" ON "ProductVariant" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "Product_category_idx" ON "Product" USING btree ("category");--> statement-breakpoint
CREATE INDEX "Product_createdAt_idx" ON "Product" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Product_deletedAt_idx" ON "Product" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Refund_orderId_idx" ON "Refund" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "Refund_status_idx" ON "Refund" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Refund_createdAt_idx" ON "Refund" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Refund_gatewayRefundId_key" ON "Refund" USING btree ("gatewayRefundId");--> statement-breakpoint
CREATE INDEX "ReviewVote_reviewId_idx" ON "ReviewVote" USING btree ("reviewId");--> statement-breakpoint
CREATE INDEX "ReviewVote_userId_idx" ON "ReviewVote" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Review_productId_idx" ON "Review" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "Review_userId_idx" ON "Review" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Review_productId_rating_idx" ON "Review" USING btree ("productId","rating");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "StockReservation_status_expiresAt_idx" ON "StockReservation" USING btree ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "StockReservation_variantId_status_idx" ON "StockReservation" USING btree ("variantId","status");--> statement-breakpoint
CREATE INDEX "StockReservation_checkoutRequestId_idx" ON "StockReservation" USING btree ("checkoutRequestId");--> statement-breakpoint
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent" USING btree ("receivedAt");--> statement-breakpoint
CREATE INDEX "Wishlist_userId_idx" ON "Wishlist" USING btree ("userId");