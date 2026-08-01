CREATE TYPE "public"."DiscountType" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BOGO');--> statement-breakpoint
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
ALTER TABLE "CheckoutRequest" ADD COLUMN "couponCode" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "discountAmount" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "couponId" varchar(7);--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "couponCode" text;--> statement-breakpoint
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_Coupon_id_fk" FOREIGN KEY ("couponId") REFERENCES "public"."Coupon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption" USING btree ("couponId");--> statement-breakpoint
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "CouponRedemption_createdAt_idx" ON "CouponRedemption" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Coupon_isActive_idx" ON "Coupon" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "Coupon_endsAt_idx" ON "Coupon" USING btree ("endsAt");--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_Coupon_id_fk" FOREIGN KEY ("couponId") REFERENCES "public"."Coupon"("id") ON DELETE set null ON UPDATE no action;