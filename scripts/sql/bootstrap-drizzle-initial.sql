-- Idempotent bootstrap for the full current schema.
--
-- Generated from the bundled Drizzle migrations (drizzle/*.sql). Applying this
-- file to an empty database, or to a database that is already partially
-- migrated, leaves it matching the latest migration and records every bundled
-- migration as applied so `npm run db:migrate` becomes a no-op.
--
-- Regenerate this file whenever a new migration is added: apply every file in
-- drizzle/ to a scratch database in order, then mirror the resulting schema
-- here.

BEGIN;

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

CREATE OR REPLACE FUNCTION drizzle.ensure_public_enum(type_name text, enum_ddl text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = type_name AND n.nspname = 'public'
  ) THEN
    EXECUTE enum_ddl;
  END IF;
END
$$;

-- ─── Enum types ──────────────────────────────────────────

SELECT drizzle.ensure_public_enum(
  'CheckoutRequestStatus',
  'CREATE TYPE public."CheckoutRequestStatus" AS ENUM (''PENDING'', ''PROCESSING'', ''COMPLETED'', ''FAILED'')'
);

SELECT drizzle.ensure_public_enum(
  'EmailType',
  'CREATE TYPE public."EmailType" AS ENUM (''order_confirmation'', ''order_status_update'', ''order_refund_update'')'
);

-- Widen an existing enum created before refund emails were added.
ALTER TYPE public."EmailType" ADD VALUE IF NOT EXISTS 'order_refund_update';

SELECT drizzle.ensure_public_enum(
  'FailedEmailStatus',
  'CREATE TYPE public."FailedEmailStatus" AS ENUM (''pending'', ''failed'', ''sent'')'
);

SELECT drizzle.ensure_public_enum(
  'DiscountType',
  'CREATE TYPE public."DiscountType" AS ENUM (''PERCENTAGE'', ''FIXED_AMOUNT'', ''FREE_SHIPPING'', ''BOGO'')'
);

SELECT drizzle.ensure_public_enum(
  'OrderStatus',
  'CREATE TYPE public."OrderStatus" AS ENUM (''PENDING'', ''PROCESSING'', ''SHIPPED'', ''DELIVERED'', ''CANCELLED'')'
);

SELECT drizzle.ensure_public_enum(
  'PaymentProvider',
  'CREATE TYPE public."PaymentProvider" AS ENUM (''RAZORPAY'', ''COD'')'
);

-- Widen an existing enum created before Cash on Delivery was registered.
ALTER TYPE public."PaymentProvider" ADD VALUE IF NOT EXISTS 'COD';

SELECT drizzle.ensure_public_enum(
  'ShippingMethod',
  'CREATE TYPE public."ShippingMethod" AS ENUM (''STANDARD'', ''EXPRESS'')'
);

SELECT drizzle.ensure_public_enum(
  'PaymentStatus',
  'CREATE TYPE public."PaymentStatus" AS ENUM (''PENDING'', ''PAID'', ''FAILED'', ''REFUNDED'', ''PARTIALLY_REFUNDED'')'
);

-- Widen an existing enum created before partial refunds were tracked separately.
ALTER TYPE public."PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

SELECT drizzle.ensure_public_enum(
  'RefundStatus',
  'CREATE TYPE public."RefundStatus" AS ENUM (''PENDING'', ''PROCESSED'', ''FAILED'')'
);

SELECT drizzle.ensure_public_enum(
  'StockReservationStatus',
  'CREATE TYPE public."StockReservationStatus" AS ENUM (''HELD'', ''CONSUMED'', ''RELEASED'', ''EXPIRED'')'
);

SELECT drizzle.ensure_public_enum(
  'UserRole',
  'CREATE TYPE public."UserRole" AS ENUM (''CUSTOMER'', ''ADMIN'', ''SUPPORT'', ''FULFILMENT'')'
);

-- Widen an existing enum created before the granular staff roles were added.
ALTER TYPE public."UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE public."UserRole" ADD VALUE IF NOT EXISTS 'FULFILMENT';

-- ─── Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public."Account" (
  "id" text NOT NULL,
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
  "session_state" text
);

CREATE TABLE IF NOT EXISTS public."Address" (
  "id" character varying(7) NOT NULL,
  "userId" text NOT NULL,
  "label" text NOT NULL,
  "addressLine1" text NOT NULL,
  "addressLine2" text,
  "addressLine3" text,
  "pinCode" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "isDefault" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."AdminAuditLog" (
  "id" character varying(7) NOT NULL,
  "userId" text NOT NULL,
  "entity" text NOT NULL,
  "entityId" text NOT NULL,
  "action" text NOT NULL,
  "diff" json DEFAULT '{}'::json NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Cart" (
  "id" character varying(7) NOT NULL,
  "userId" text,
  "sessionId" text,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."CartItem" (
  "id" character varying(7) NOT NULL,
  "cartId" character varying(7) NOT NULL,
  "productId" character varying(7) NOT NULL,
  "variantId" character varying(7) NOT NULL,
  "quantity" integer NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Category" (
  "id" character varying(7) NOT NULL,
  "name" text NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
  "deletedAt" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public."CheckoutRequest" (
  "id" character varying(7) NOT NULL,
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
  "status" "CheckoutRequestStatus" DEFAULT 'PENDING'::"CheckoutRequestStatus" NOT NULL,
  "errorMessage" text,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
  "paymentProvider" "PaymentProvider",
  "paymentOrderId" text,
  "paymentTransactionId" text,
  "paymentSignature" text
);

CREATE TABLE IF NOT EXISTS public."FailedEmail" (
  "id" character varying(7) NOT NULL,
  "recipientEmail" text NOT NULL,
  "subject" text NOT NULL,
  "bodyHtml" text NOT NULL,
  "bodyText" text NOT NULL,
  "emailType" "EmailType" NOT NULL,
  "referenceId" character varying(7) NOT NULL,
  "attemptCount" integer DEFAULT 0 NOT NULL,
  "lastError" text,
  "isRetriable" boolean DEFAULT true NOT NULL,
  "status" "FailedEmailStatus" DEFAULT 'pending'::"FailedEmailStatus" NOT NULL,
  "errorHistory" json DEFAULT '[]'::json NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "lastAttemptedAt" timestamp without time zone,
  "sentAt" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public."NotificationPreference" (
  "userId" text NOT NULL,
  "transactionalEmail" boolean DEFAULT true NOT NULL,
  "transactionalPush" boolean DEFAULT false NOT NULL,
  "transactionalSms" boolean DEFAULT false NOT NULL,
  "marketingEmail" boolean DEFAULT false NOT NULL,
  "marketingPush" boolean DEFAULT false NOT NULL,
  "marketingSms" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Order" (
  "id" character varying(10) NOT NULL,
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
  "checkoutRequestId" character varying(7),
  "totalAmount" numeric(12,2) NOT NULL,
  "status" "OrderStatus" DEFAULT 'PENDING'::"OrderStatus" NOT NULL,
  "trackingNumber" text,
  "shippingProvider" text,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
  "paymentStatus" "PaymentStatus" DEFAULT 'PENDING'::"PaymentStatus" NOT NULL,
  "paymentProvider" "PaymentProvider",
  "paymentOrderId" text,
  "paymentTransactionId" text,
  "amountPaid" numeric(12,2) DEFAULT 0 NOT NULL,
  "paidAt" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public."OrderItem" (
  "id" character varying(7) NOT NULL,
  "orderId" character varying(10) NOT NULL,
  "productId" character varying(7) NOT NULL,
  "variantId" character varying(7) NOT NULL,
  "quantity" integer NOT NULL,
  "price" numeric(12,2) NOT NULL,
  "customizationNote" text
);

CREATE TABLE IF NOT EXISTS public."PasswordHistory" (
  "id" text NOT NULL,
  "userId" text NOT NULL,
  "passwordHash" text NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Product" (
  "id" character varying(7) NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "image" text NOT NULL,
  "images" json DEFAULT '[]'::json NOT NULL,
  "category" text NOT NULL,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ProductOption" (
  "id" character varying(7) NOT NULL,
  "productId" character varying(7) NOT NULL,
  "name" text NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ProductOptionValue" (
  "id" character varying(7) NOT NULL,
  "optionId" character varying(7) NOT NULL,
  "value" text NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ProductShare" (
  "key" character varying(7) NOT NULL,
  "productId" character varying(7) NOT NULL,
  "variantId" character varying(7),
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ProductVariant" (
  "id" character varying(7) NOT NULL,
  "productId" character varying(7) NOT NULL,
  "sku" text,
  "price" numeric(12,2) NOT NULL,
  "stock" integer NOT NULL,
  "image" text,
  "images" json DEFAULT '[]'::json NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ProductVariantOptionValue" (
  "variantId" character varying(7) NOT NULL,
  "optionValueId" character varying(7) NOT NULL
);

CREATE TABLE IF NOT EXISTS public."PushSubscription" (
  "id" character varying(7) NOT NULL,
  "userId" text NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "userAgent" text,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Review" (
  "id" character varying(7) NOT NULL,
  "productId" character varying(7) NOT NULL,
  "orderId" character varying(10),
  "userId" text,
  "rating" integer NOT NULL,
  "comment" text NOT NULL,
  "isAnonymous" boolean DEFAULT false NOT NULL,
  "isVerifiedBuyer" boolean DEFAULT false NOT NULL,
  "helpfulCount" integer DEFAULT 0 NOT NULL,
  "notHelpfulCount" integer DEFAULT 0 NOT NULL,
  "isFeatured" boolean DEFAULT false NOT NULL,
  "isHidden" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ReviewVote" (
  "id" character varying(7) NOT NULL,
  "reviewId" character varying(7) NOT NULL,
  "userId" text NOT NULL,
  "vote" integer NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Session" (
  "sessionToken" text NOT NULL,
  "userId" text NOT NULL,
  "expires" timestamp without time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS public."User" (
  "id" text NOT NULL,
  "name" text,
  "email" text NOT NULL,
  "emailVerified" timestamp without time zone,
  "image" text,
  "passwordHash" text,
  "phoneNumber" character varying(20),
  "currencyPreference" character varying(3) DEFAULT 'INR'::character varying NOT NULL,
  "role" "UserRole" DEFAULT 'CUSTOMER'::"UserRole" NOT NULL,
  "lockedUntil" timestamp without time zone,
  "sessionVersion" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."VerificationToken" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp without time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Coupon" (
  "id" character varying(7) NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "discountType" "DiscountType" NOT NULL,
  "discountValue" numeric(12,2) DEFAULT 0 NOT NULL,
  "maxDiscountAmount" numeric(12,2),
  "minCartValue" numeric(12,2) DEFAULT 0 NOT NULL,
  "scopedCategories" json DEFAULT '[]'::json NOT NULL,
  "scopedProductIds" json DEFAULT '[]'::json NOT NULL,
  "usageLimit" integer,
  "perUserLimit" integer,
  "usageCount" integer DEFAULT 0 NOT NULL,
  "stackable" boolean DEFAULT false NOT NULL,
  "isActive" boolean DEFAULT true NOT NULL,
  "startsAt" timestamp without time zone,
  "endsAt" timestamp without time zone,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."CouponRedemption" (
  "id" character varying(7) NOT NULL,
  "couponId" character varying(7) NOT NULL,
  "userId" text,
  "orderId" character varying(10) NOT NULL,
  "discountAmount" numeric(12,2) NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Refund" (
  "id" character varying(7) NOT NULL,
  "orderId" character varying(10) NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "paymentTransactionId" text NOT NULL,
  "gatewayRefundId" text,
  "amount" numeric(12,2) NOT NULL,
  "status" "RefundStatus" DEFAULT 'PENDING'::"RefundStatus" NOT NULL,
  "reason" text,
  "errorMessage" text,
  "initiatedById" text,
  "processedAt" timestamp without time zone,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."WebhookEvent" (
  "id" character varying(7) NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "eventId" text NOT NULL,
  "eventType" text NOT NULL,
  "receivedAt" timestamp without time zone DEFAULT now() NOT NULL,
  "processedAt" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public."StockReservation" (
  "id" character varying(7) NOT NULL,
  "checkoutRequestId" character varying(7) NOT NULL,
  "variantId" character varying(7) NOT NULL,
  "quantity" integer NOT NULL,
  "status" public."StockReservationStatus" DEFAULT 'HELD' NOT NULL,
  "expiresAt" timestamp without time zone NOT NULL,
  "settledAt" timestamp without time zone,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Wishlist" (
  "id" character varying(7) NOT NULL,
  "userId" text NOT NULL,
  "productId" character varying(7) NOT NULL,
  "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ProductAffinityScore" (
  "id" character varying(7) NOT NULL,
  "anchorProductId" character varying(7) NOT NULL,
  "recommendedProductId" character varying(7) NOT NULL,
  "score" double precision NOT NULL,
  "support" integer NOT NULL,
  "source" text DEFAULT 'combined' NOT NULL,
  "computedAt" timestamp without time zone DEFAULT now() NOT NULL
);

-- ─── Column catch-up ─────────────────────────────────────
-- Adds columns introduced by later migrations to databases created from an
-- earlier snapshot. Columns that are NOT NULL without a default are omitted
-- because they cannot be added to a table that already holds rows; those are
-- handled by the ordinary migrations.

ALTER TABLE public."Account" ADD COLUMN IF NOT EXISTS "refresh_token" text;
ALTER TABLE public."Account" ADD COLUMN IF NOT EXISTS "access_token" text;
ALTER TABLE public."Account" ADD COLUMN IF NOT EXISTS "expires_at" integer;
ALTER TABLE public."Account" ADD COLUMN IF NOT EXISTS "token_type" text;
ALTER TABLE public."Account" ADD COLUMN IF NOT EXISTS "scope" text;
ALTER TABLE public."Account" ADD COLUMN IF NOT EXISTS "id_token" text;
ALTER TABLE public."Account" ADD COLUMN IF NOT EXISTS "session_state" text;

ALTER TABLE public."Address" ADD COLUMN IF NOT EXISTS "addressLine2" text;
ALTER TABLE public."Address" ADD COLUMN IF NOT EXISTS "addressLine3" text;
ALTER TABLE public."Address" ADD COLUMN IF NOT EXISTS "isDefault" boolean DEFAULT false NOT NULL;
ALTER TABLE public."Address" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Address" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."AdminAuditLog" ADD COLUMN IF NOT EXISTS "diff" json DEFAULT '{}'::json NOT NULL;
ALTER TABLE public."AdminAuditLog" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."AdminAuditLog" ADD COLUMN IF NOT EXISTS "role" "UserRole";

ALTER TABLE public."Cart" ADD COLUMN IF NOT EXISTS "userId" text;
ALTER TABLE public."Cart" ADD COLUMN IF NOT EXISTS "sessionId" text;
ALTER TABLE public."Cart" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Cart" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."CartItem" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."CartItem" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."Category" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."Category" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Category" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Category" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp without time zone;

ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "addressLine1" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "addressLine2" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "addressLine3" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "pinCode" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "status" "CheckoutRequestStatus" DEFAULT 'PENDING'::"CheckoutRequestStatus" NOT NULL;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "errorMessage" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "paymentProvider" "PaymentProvider";
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "paymentOrderId" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "paymentTransactionId" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "paymentSignature" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "shippingMethod" "ShippingMethod";

ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "attemptCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "lastError" text;
ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "isRetriable" boolean DEFAULT true NOT NULL;
ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "status" "FailedEmailStatus" DEFAULT 'pending'::"FailedEmailStatus" NOT NULL;
ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "errorHistory" json DEFAULT '[]'::json NOT NULL;
ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "lastAttemptedAt" timestamp without time zone;
ALTER TABLE public."FailedEmail" ADD COLUMN IF NOT EXISTS "sentAt" timestamp without time zone;

ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "userId" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "addressLine1" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "addressLine2" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "addressLine3" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "pinCode" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "checkoutRequestId" character varying(7);
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" DEFAULT 'PENDING'::"OrderStatus" NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "trackingNumber" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "shippingProvider" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" DEFAULT 'PENDING'::"PaymentStatus" NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "paymentProvider" "PaymentProvider";
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "paymentOrderId" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "paymentTransactionId" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "amountPaid" numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "paidAt" timestamp without time zone;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "subtotalAmount" numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "shippingAmount" numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "taxAmount" numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "shippingMethod" "ShippingMethod";
UPDATE public."Order" SET "subtotalAmount" = "totalAmount" WHERE "subtotalAmount" = 0;

ALTER TABLE public."OrderItem" ADD COLUMN IF NOT EXISTS "customizationNote" text;

ALTER TABLE public."PasswordHistory" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS "images" json DEFAULT '[]'::json NOT NULL;
ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp without time zone;
ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."ProductOption" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."ProductOption" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."ProductOptionValue" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."ProductOptionValue" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."ProductShare" ADD COLUMN IF NOT EXISTS "variantId" character varying(7);
ALTER TABLE public."ProductShare" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "sku" text;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "image" text;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "images" json DEFAULT '[]'::json NOT NULL;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp without time zone;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "weightGrams" integer;
ALTER TABLE public."ProductVariant" ADD COLUMN IF NOT EXISTS "reservedStock" integer DEFAULT 0 NOT NULL;

ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "orderId" character varying(10);
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "userId" text;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "isAnonymous" boolean DEFAULT false NOT NULL;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "isVerifiedBuyer" boolean DEFAULT false NOT NULL;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "helpfulCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "notHelpfulCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "isFeatured" boolean DEFAULT false NOT NULL;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "isHidden" boolean DEFAULT false NOT NULL;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."Review" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."ReviewVote" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."ReviewVote" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "emailVerified" timestamp without time zone;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "image" text;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "passwordHash" text;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "phoneNumber" character varying(20);
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "currencyPreference" character varying(3) DEFAULT 'INR'::character varying NOT NULL;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "role" "UserRole" DEFAULT 'CUSTOMER'::"UserRole" NOT NULL;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp without time zone;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "sessionVersion" integer DEFAULT 0 NOT NULL;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "discountAmount" numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "couponId" character varying(7);
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "couponCode" text;
ALTER TABLE public."CheckoutRequest" ADD COLUMN IF NOT EXISTS "couponCode" text;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "stockRestoredAt" timestamp without time zone;
ALTER TABLE public."WebhookEvent" ADD COLUMN IF NOT EXISTS "receivedAt" timestamp without time zone DEFAULT now() NOT NULL;
ALTER TABLE public."WebhookEvent" ADD COLUMN IF NOT EXISTS "processedAt" timestamp without time zone;

ALTER TABLE public."Wishlist" ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone DEFAULT now() NOT NULL;

-- ─── Monetary columns ────────────────────────────────────
-- Money is stored as exact decimals. Convert any legacy floating point columns
-- in place; re-running this is a no-op once the column is already numeric.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'double precision'
      AND (table_name, column_name) IN (
        ('Order', 'totalAmount'),
        ('Order', 'amountPaid'),
        ('OrderItem', 'price'),
        ('ProductVariant', 'price')
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE numeric(12, 2) USING round(%I::numeric, 2)',
      target.table_name, target.column_name, target.column_name
    );
  END LOOP;
END
$$;

-- ─── Removed columns ─────────────────────────────────────
ALTER TABLE public."Product" DROP COLUMN IF EXISTS "localizedContent";
ALTER TABLE public."User" DROP COLUMN IF EXISTS "localePreference";

-- ─── Constraints ─────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Account"'::regclass
      AND (conname = 'Account_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Account" ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Address"'::regclass
      AND (conname = 'Address_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Address" ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."NotificationPreference"'::regclass
      AND (conname = 'NotificationPreference_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY ("userId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."NotificationPreference" ADD CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."PushSubscription"'::regclass
      AND (conname = 'PushSubscription_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."PushSubscription" ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."PushSubscription"'::regclass
      AND (conname = 'PushSubscription_endpoint_unique' OR pg_get_constraintdef(oid) = 'UNIQUE (endpoint)')
  ) THEN
    EXECUTE 'ALTER TABLE public."PushSubscription" ADD CONSTRAINT "PushSubscription_endpoint_unique" UNIQUE (endpoint)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."AdminAuditLog"'::regclass
      AND (conname = 'AdminAuditLog_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Cart"'::regclass
      AND (conname = 'Cart_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Cart" ADD CONSTRAINT "Cart_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CartItem"'::regclass
      AND (conname = 'CartItem_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Category"'::regclass
      AND (conname = 'Category_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Category" ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CheckoutRequest"'::regclass
      AND (conname = 'CheckoutRequest_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."CheckoutRequest" ADD CONSTRAINT "CheckoutRequest_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."FailedEmail"'::regclass
      AND (conname = 'FailedEmail_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."FailedEmail" ADD CONSTRAINT "FailedEmail_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Order"'::regclass
      AND (conname = 'Order_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Order" ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."OrderItem"'::regclass
      AND (conname = 'OrderItem_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."PasswordHistory"'::regclass
      AND (conname = 'PasswordHistory_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."PasswordHistory" ADD CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Product"'::regclass
      AND (conname = 'Product_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Product" ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductOption"'::regclass
      AND (conname = 'ProductOption_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductOption" ADD CONSTRAINT "ProductOption_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductOptionValue"'::regclass
      AND (conname = 'ProductOptionValue_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductShare"'::regclass
      AND (conname = 'ProductShare_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (key)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductShare" ADD CONSTRAINT "ProductShare_pkey" PRIMARY KEY (key)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductVariant"'::regclass
      AND (conname = 'ProductVariant_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductVariant" ADD CONSTRAINT "ProductVariant_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."StockReservation"'::regclass
      AND (conname = 'StockReservation_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."StockReservation" ADD CONSTRAINT "StockReservation_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."StockReservation"'::regclass
      AND (conname = 'StockReservation_checkoutRequestId_variantId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("checkoutRequestId", "variantId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."StockReservation" ADD CONSTRAINT "StockReservation_checkoutRequestId_variantId_key" UNIQUE ("checkoutRequestId", "variantId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."StockReservation"'::regclass
      AND conname = 'StockReservation_quantity_positive'
  ) THEN
    EXECUTE 'ALTER TABLE public."StockReservation" ADD CONSTRAINT "StockReservation_quantity_positive" CHECK ("quantity" > 0)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductVariant"'::regclass
      AND conname = 'ProductVariant_reservedStock_non_negative'
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductVariant" ADD CONSTRAINT "ProductVariant_reservedStock_non_negative" CHECK ("reservedStock" >= 0)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductAffinityScore"'::regclass
      AND (conname = 'ProductAffinityScore_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductAffinityScore"'::regclass
      AND (conname = 'ProductAffinityScore_anchor_recommended_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("anchorProductId", "recommendedProductId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_anchor_recommended_key" UNIQUE ("anchorProductId", "recommendedProductId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductAffinityScore"'::regclass
      AND conname = 'ProductAffinityScore_no_self_reference'
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_no_self_reference" CHECK ("anchorProductId" <> "recommendedProductId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductAffinityScore"'::regclass
      AND conname = 'ProductAffinityScore_support_positive'
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_support_positive" CHECK ("support" >= 1)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Review"'::regclass
      AND (conname = 'Review_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Review" ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ReviewVote"'::regclass
      AND (conname = 'ReviewVote_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ReviewVote" ADD CONSTRAINT "ReviewVote_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Session"'::regclass
      AND (conname = 'Session_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY ("sessionToken")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Session" ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."User"'::regclass
      AND (conname = 'User_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."User" ADD CONSTRAINT "User_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Coupon"'::regclass
      AND (conname = 'Coupon_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Coupon" ADD CONSTRAINT "Coupon_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CouponRedemption"'::regclass
      AND (conname = 'CouponRedemption_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."CouponRedemption" ADD CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."WebhookEvent"'::regclass
      AND (conname = 'WebhookEvent_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."WebhookEvent" ADD CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Wishlist"'::regclass
      AND (conname = 'Wishlist_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Account"'::regclass
      AND (conname = 'Account_provider_providerAccountId_key' OR pg_get_constraintdef(oid) = 'UNIQUE (provider, "providerAccountId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Account" ADD CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE (provider, "providerAccountId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Cart"'::regclass
      AND (conname = 'Cart_sessionId_unique' OR pg_get_constraintdef(oid) = 'UNIQUE ("sessionId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Cart" ADD CONSTRAINT "Cart_sessionId_unique" UNIQUE ("sessionId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Cart"'::regclass
      AND (conname = 'Cart_userId_unique' OR pg_get_constraintdef(oid) = 'UNIQUE ("userId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Cart" ADD CONSTRAINT "Cart_userId_unique" UNIQUE ("userId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CartItem"'::regclass
      AND (conname = 'CartItem_cartId_productId_variantId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("cartId", "productId", "variantId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_cartId_productId_variantId_key" UNIQUE ("cartId", "productId", "variantId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Category"'::regclass
      AND (conname = 'Category_name_unique' OR pg_get_constraintdef(oid) = 'UNIQUE (name)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Category" ADD CONSTRAINT "Category_name_unique" UNIQUE (name)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Order"'::regclass
      AND (conname = 'Order_checkoutRequestId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("checkoutRequestId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Order" ADD CONSTRAINT "Order_checkoutRequestId_key" UNIQUE ("checkoutRequestId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Order"'::regclass
      AND (conname = 'Order_paymentTransactionId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("paymentTransactionId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Order" ADD CONSTRAINT "Order_paymentTransactionId_key" UNIQUE ("paymentTransactionId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductOption"'::regclass
      AND (conname = 'ProductOption_productId_name_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("productId", name)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductOption" ADD CONSTRAINT "ProductOption_productId_name_key" UNIQUE ("productId", name)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductOptionValue"'::regclass
      AND (conname = 'ProductOptionValue_optionId_value_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("optionId", value)')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_value_key" UNIQUE ("optionId", value)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductVariantOptionValue"'::regclass
      AND (conname = 'ProductVariantOptionValue_pk' OR pg_get_constraintdef(oid) = 'UNIQUE ("variantId", "optionValueId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_pk" UNIQUE ("variantId", "optionValueId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Review"'::regclass
      AND (conname = 'Review_userId_productId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("userId", "productId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Review" ADD CONSTRAINT "Review_userId_productId_key" UNIQUE ("userId", "productId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ReviewVote"'::regclass
      AND (conname = 'ReviewVote_reviewId_userId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("reviewId", "userId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_userId_key" UNIQUE ("reviewId", "userId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."User"'::regclass
      AND (conname = 'User_email_unique' OR pg_get_constraintdef(oid) = 'UNIQUE (email)')
  ) THEN
    EXECUTE 'ALTER TABLE public."User" ADD CONSTRAINT "User_email_unique" UNIQUE (email)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."User"'::regclass
      AND (conname = 'User_phoneNumber_unique' OR pg_get_constraintdef(oid) = 'UNIQUE ("phoneNumber")')
  ) THEN
    EXECUTE 'ALTER TABLE public."User" ADD CONSTRAINT "User_phoneNumber_unique" UNIQUE ("phoneNumber")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."VerificationToken"'::regclass
      AND (conname = 'VerificationToken_identifier_token_key' OR pg_get_constraintdef(oid) = 'UNIQUE (identifier, token)')
  ) THEN
    EXECUTE 'ALTER TABLE public."VerificationToken" ADD CONSTRAINT "VerificationToken_identifier_token_key" UNIQUE (identifier, token)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."VerificationToken"'::regclass
      AND (conname = 'VerificationToken_token_unique' OR pg_get_constraintdef(oid) = 'UNIQUE (token)')
  ) THEN
    EXECUTE 'ALTER TABLE public."VerificationToken" ADD CONSTRAINT "VerificationToken_token_unique" UNIQUE (token)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Coupon"'::regclass
      AND (conname = 'Coupon_code_unique' OR pg_get_constraintdef(oid) = 'UNIQUE (code)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Coupon" ADD CONSTRAINT "Coupon_code_unique" UNIQUE (code)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CouponRedemption"'::regclass
      AND (conname = 'CouponRedemption_couponId_orderId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("couponId", "orderId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_orderId_key" UNIQUE ("couponId", "orderId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Refund"'::regclass
      AND (conname = 'Refund_pkey' OR pg_get_constraintdef(oid) = 'PRIMARY KEY (id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Refund" ADD CONSTRAINT "Refund_pkey" PRIMARY KEY (id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."WebhookEvent"'::regclass
      AND (conname = 'WebhookEvent_provider_eventId_key' OR pg_get_constraintdef(oid) = 'UNIQUE (provider, "eventId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."WebhookEvent" ADD CONSTRAINT "WebhookEvent_provider_eventId_key" UNIQUE (provider, "eventId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Wishlist"'::regclass
      AND (conname = 'Wishlist_userId_productId_key' OR pg_get_constraintdef(oid) = 'UNIQUE ("userId", "productId")')
  ) THEN
    EXECUTE 'ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_userId_productId_key" UNIQUE ("userId", "productId")';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Account"'::regclass
      AND (conname = 'Account_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Address"'::regclass
      AND (conname = 'Address_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Address" ADD CONSTRAINT "Address_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductAffinityScore"'::regclass
      AND (conname = 'ProductAffinityScore_anchorProductId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("anchorProductId") REFERENCES "Product"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_anchorProductId_Product_id_fk" FOREIGN KEY ("anchorProductId") REFERENCES "Product"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductAffinityScore"'::regclass
      AND (conname = 'ProductAffinityScore_recommendedProductId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("recommendedProductId") REFERENCES "Product"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductAffinityScore" ADD CONSTRAINT "ProductAffinityScore_recommendedProductId_Product_id_fk" FOREIGN KEY ("recommendedProductId") REFERENCES "Product"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."NotificationPreference"'::regclass
      AND (conname = 'NotificationPreference_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."PushSubscription"'::regclass
      AND (conname = 'PushSubscription_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."PushSubscription" ADD CONSTRAINT "PushSubscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."AdminAuditLog"'::regclass
      AND (conname = 'AdminAuditLog_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Cart"'::regclass
      AND (conname = 'Cart_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Cart" ADD CONSTRAINT "Cart_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CartItem"'::regclass
      AND (conname = 'CartItem_cartId_Cart_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("cartId") REFERENCES "Cart"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES "Cart"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CartItem"'::regclass
      AND (conname = 'CartItem_productId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES "Product"(id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"(id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CartItem"'::regclass
      AND (conname = 'CartItem_variantId_ProductVariant_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CheckoutRequest"'::regclass
      AND (conname = 'CheckoutRequest_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."CheckoutRequest" ADD CONSTRAINT "CheckoutRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Order"'::regclass
      AND (conname = 'Order_checkoutRequestId_CheckoutRequest_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("checkoutRequestId") REFERENCES "CheckoutRequest"(id) ON DELETE SET NULL')
  ) THEN
    EXECUTE 'ALTER TABLE public."Order" ADD CONSTRAINT "Order_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES "CheckoutRequest"(id) ON DELETE SET NULL';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Order"'::regclass
      AND (conname = 'Order_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."Order" ADD CONSTRAINT "Order_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."OrderItem"'::regclass
      AND (conname = 'OrderItem_orderId_Order_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."OrderItem"'::regclass
      AND (conname = 'OrderItem_productId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES "Product"(id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"(id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."OrderItem"'::regclass
      AND (conname = 'OrderItem_variantId_ProductVariant_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id)')
  ) THEN
    EXECUTE 'ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id)';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."PasswordHistory"'::regclass
      AND (conname = 'PasswordHistory_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductOption"'::regclass
      AND (conname = 'ProductOption_productId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductOption" ADD CONSTRAINT "ProductOption_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductOptionValue"'::regclass
      AND (conname = 'ProductOptionValue_optionId_ProductOption_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("optionId") REFERENCES "ProductOption"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_ProductOption_id_fk" FOREIGN KEY ("optionId") REFERENCES "ProductOption"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductShare"'::regclass
      AND (conname = 'ProductShare_productId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductShare" ADD CONSTRAINT "ProductShare_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductShare"'::regclass
      AND (conname = 'ProductShare_variantId_ProductVariant_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id) ON DELETE SET NULL')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductShare" ADD CONSTRAINT "ProductShare_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id) ON DELETE SET NULL';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductVariant"'::regclass
      AND (conname = 'ProductVariant_productId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductVariant" ADD CONSTRAINT "ProductVariant_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductVariantOptionValue"'::regclass
      AND (conname = 'ProductVariantOptionValue_optionValueId_ProductOptionValue_id_f' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionValueId_ProductOptionValue_id_f" FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ProductVariantOptionValue"'::regclass
      AND (conname = 'ProductVariantOptionValue_variantId_ProductVariant_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Review"'::regclass
      AND (conname = 'Review_orderId_Order_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE SET NULL')
  ) THEN
    EXECUTE 'ALTER TABLE public."Review" ADD CONSTRAINT "Review_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE SET NULL';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Review"'::regclass
      AND (conname = 'Review_productId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Review" ADD CONSTRAINT "Review_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Review"'::regclass
      AND (conname = 'Review_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL')
  ) THEN
    EXECUTE 'ALTER TABLE public."Review" ADD CONSTRAINT "Review_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ReviewVote"'::regclass
      AND (conname = 'ReviewVote_reviewId_Review_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("reviewId") REFERENCES "Review"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_Review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "Review"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ReviewVote"'::regclass
      AND (conname = 'ReviewVote_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."ReviewVote" ADD CONSTRAINT "ReviewVote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Session"'::regclass
      AND (conname = 'Session_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Wishlist"'::regclass
      AND (conname = 'Wishlist_productId_Product_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Wishlist"'::regclass
      AND (conname = 'Wishlist_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CouponRedemption"'::regclass
      AND (conname = 'CouponRedemption_couponId_Coupon_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("couponId") REFERENCES "Coupon"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_Coupon_id_fk" FOREIGN KEY ("couponId") REFERENCES "Coupon"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CouponRedemption"'::regclass
      AND (conname = 'CouponRedemption_userId_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL')
  ) THEN
    EXECUTE 'ALTER TABLE public."CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CouponRedemption"'::regclass
      AND (conname = 'CouponRedemption_orderId_Order_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."StockReservation"'::regclass
      AND (conname = 'StockReservation_checkoutRequestId_CheckoutRequest_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("checkoutRequestId") REFERENCES "CheckoutRequest"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."StockReservation" ADD CONSTRAINT "StockReservation_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES "CheckoutRequest"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."StockReservation"'::regclass
      AND (conname = 'StockReservation_variantId_ProductVariant_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."StockReservation" ADD CONSTRAINT "StockReservation_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Refund"'::regclass
      AND (conname = 'Refund_orderId_Order_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE')
  ) THEN
    EXECUTE 'ALTER TABLE public."Refund" ADD CONSTRAINT "Refund_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Refund"'::regclass
      AND (conname = 'Refund_initiatedById_User_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("initiatedById") REFERENCES "User"(id) ON DELETE SET NULL')
  ) THEN
    EXECUTE 'ALTER TABLE public."Refund" ADD CONSTRAINT "Refund_initiatedById_User_id_fk" FOREIGN KEY ("initiatedById") REFERENCES "User"(id) ON DELETE SET NULL';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Order"'::regclass
      AND (conname = 'Order_couponId_Coupon_id_fk' OR pg_get_constraintdef(oid) = 'FOREIGN KEY ("couponId") REFERENCES "Coupon"(id) ON DELETE SET NULL')
  ) THEN
    EXECUTE 'ALTER TABLE public."Order" ADD CONSTRAINT "Order_couponId_Coupon_id_fk" FOREIGN KEY ("couponId") REFERENCES "Coupon"(id) ON DELETE SET NULL';
  END IF;
END
$$;

-- ─── Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON public."Account" USING btree ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Address_one_default_per_user_idx" ON public."Address" USING btree ("userId") WHERE ("isDefault" = true);
CREATE INDEX IF NOT EXISTS "Address_userId_idx" ON public."Address" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON public."PushSubscription" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON public."AdminAuditLog" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_entity_idx" ON public."AdminAuditLog" USING btree (entity);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_userId_idx" ON public."AdminAuditLog" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "CartItem_cartId_idx" ON public."CartItem" USING btree ("cartId");
CREATE INDEX IF NOT EXISTS "CartItem_productId_idx" ON public."CartItem" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "CartItem_variantId_idx" ON public."CartItem" USING btree ("variantId");
CREATE INDEX IF NOT EXISTS "Cart_sessionId_idx" ON public."Cart" USING btree ("sessionId");
CREATE INDEX IF NOT EXISTS "CheckoutRequest_createdAt_idx" ON public."CheckoutRequest" USING btree ("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutRequest_paymentTransactionId_key" ON public."CheckoutRequest" USING btree ("paymentTransactionId");
CREATE INDEX IF NOT EXISTS "CheckoutRequest_status_idx" ON public."CheckoutRequest" USING btree (status);
CREATE INDEX IF NOT EXISTS "CheckoutRequest_userId_idx" ON public."CheckoutRequest" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "FailedEmail_createdAt_idx" ON public."FailedEmail" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "FailedEmail_recipientEmail_status_idx" ON public."FailedEmail" USING btree ("recipientEmail", status);
CREATE INDEX IF NOT EXISTS "FailedEmail_referenceId_idx" ON public."FailedEmail" USING btree ("referenceId");
CREATE INDEX IF NOT EXISTS "FailedEmail_status_idx" ON public."FailedEmail" USING btree (status);
CREATE INDEX IF NOT EXISTS "FailedEmail_status_isRetriable_createdAt_idx" ON public."FailedEmail" USING btree (status, "isRetriable", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON public."OrderItem" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx" ON public."OrderItem" USING btree ("variantId");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON public."Order" USING btree ("paymentStatus");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON public."Order" USING btree (status);
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON public."Order" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "PasswordHistory_userId_idx" ON public."PasswordHistory" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "ProductOptionValue_optionId_idx" ON public."ProductOptionValue" USING btree ("optionId");
CREATE INDEX IF NOT EXISTS "ProductOption_productId_idx" ON public."ProductOption" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "ProductShare_productId_idx" ON public."ProductShare" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "ProductShare_variantId_idx" ON public."ProductShare" USING btree ("variantId");
CREATE INDEX IF NOT EXISTS "ProductVariantOptionValue_optionValueId_idx" ON public."ProductVariantOptionValue" USING btree ("optionValueId");
CREATE INDEX IF NOT EXISTS "ProductVariantOptionValue_variantId_idx" ON public."ProductVariantOptionValue" USING btree ("variantId");
CREATE INDEX IF NOT EXISTS "ProductVariant_deletedAt_idx" ON public."ProductVariant" USING btree ("deletedAt");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON public."ProductVariant" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON public."Coupon" USING btree ("isActive");
CREATE INDEX IF NOT EXISTS "Coupon_endsAt_idx" ON public."Coupon" USING btree ("endsAt");
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON public."CouponRedemption" USING btree ("couponId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_idx" ON public."CouponRedemption" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_createdAt_idx" ON public."CouponRedemption" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "StockReservation_status_expiresAt_idx" ON public."StockReservation" USING btree (status, "expiresAt");
CREATE INDEX IF NOT EXISTS "StockReservation_variantId_status_idx" ON public."StockReservation" USING btree ("variantId", status);
CREATE INDEX IF NOT EXISTS "StockReservation_checkoutRequestId_idx" ON public."StockReservation" USING btree ("checkoutRequestId");
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON public."Product" USING btree (category);
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON public."Product" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "Product_deletedAt_idx" ON public."Product" USING btree ("deletedAt");
CREATE INDEX IF NOT EXISTS "ReviewVote_reviewId_idx" ON public."ReviewVote" USING btree ("reviewId");
CREATE INDEX IF NOT EXISTS "ReviewVote_userId_idx" ON public."ReviewVote" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON public."Review" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "Review_productId_rating_idx" ON public."Review" USING btree ("productId", rating);
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON public."Review" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON public."Session" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "Refund_orderId_idx" ON public."Refund" USING btree ("orderId");
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON public."Refund" USING btree (status);
CREATE INDEX IF NOT EXISTS "Refund_createdAt_idx" ON public."Refund" USING btree ("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_gatewayRefundId_key" ON public."Refund" USING btree ("gatewayRefundId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_receivedAt_idx" ON public."WebhookEvent" USING btree ("receivedAt");
CREATE INDEX IF NOT EXISTS "Wishlist_userId_idx" ON public."Wishlist" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "ProductAffinityScore_anchor_score_idx" ON public."ProductAffinityScore" USING btree ("anchorProductId", "score" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "ProductAffinityScore_recommendedProductId_idx" ON public."ProductAffinityScore" USING btree ("recommendedProductId");
CREATE INDEX IF NOT EXISTS "ProductAffinityScore_computedAt_idx" ON public."ProductAffinityScore" USING btree ("computedAt");

-- ─── Migration bookkeeping ───────────────────────────────
-- Record every bundled migration so `drizzle-kit migrate` treats this database
-- as fully migrated.

-- 0000_init
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0c2480c838fd5da9e0d483731cc4a1ed8b99388cca08c89295698a2c73e62b7e', 1779808524594
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1779808524594
);

-- 0001_needy_hellcat
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'ec362f0b86c778d3290a0013335aaa28b939681d0c5afb70698b46ba069fd7ac', 1779903939392
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1779903939392
);

-- 0002_nosy_natasha_romanoff
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'ea0a83a05fd5c05bb5eee07f4af9d148a7c4c9ba94d7a32df82c2114cdbff695', 1780057012196
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1780057012196
);

-- 0003_robust_ultimo
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '350bfebd5e22670085ef62d8d483c6d992fbbceb00b9455491f61dccf84a633b', 1780073500719
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1780073500719
);

-- 0004_fearless_catseye
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '993b6c71426f17827517f0491cdee461b1c36a5943089ad8785325db4f3b90c5', 1782414045928
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1782414045928
);

-- 0005_simple_roland_deschain
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '8a21d1fa9433e4b765276ad996291e7d51cee7735ac9fd4c1d948a2ab0cfa276', 1784987393847
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1784987393847
);

-- 0006_money_and_webhook_events
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '984c731ceb56e1923cb8945780309f92be97e55c61923d6bb41dde32541516f1', 1785040622095
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785040622095
);

-- 0007_customer_notifications
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '57e7c0c4af166df78d3a494e01476a7621c2cb2482880dbb42d44e0408d3f4d6', 1785043681036
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785043681036
);

-- 0008_payment_provider_cod
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'c033ca498558ad708c7d5294a7826fdf170d7ecaf23fafbb86ce3be31a67b52d', 1785045263003
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785045263003
);

-- 0009_granular_admin_roles
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '4ac2fb43b8ded0b2862f03678e39d302bbd0a60fbf28ca6e8cf0dd4a20d94f59', 1785046562695
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785046562695
);

-- 0010_shipping_tax_engine
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '417d443ac3cadb43492f3ac5f3f58dffc7d0a8d7eb86056662ff2a0684dbb685', 1785047423992
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785047423992
);

-- 0011_coupon_engine
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '76ff64f78229f467e0006468d24255a17e15996245bd16625a21781e20fc5c3a', 1785050938241
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785050938241
);

-- 0012_refunds
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'a53a0ad38185ec683734ff1b7307db7e0df6a9b9532f074cd8faeff2cded1802', 1785055842528
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785055842528
);

-- 0013_abandoned_cart_reminders
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '50f3b0ab7a94f3e8eb060aa8a45e6f1272186c47490fca1fbb0176b957ebc9c7', 1785055842529
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785055842529
);

-- 0014_partially_refunded_payment_status
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'ac1d03c3c3fe63ccd277a072caa461cba9dbedbb6fd20e16a2cf8e6097a0ead9', 1785696565550
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1785696565550
);

-- 0015_stock_reservations
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '41bdff6f9153a0d1985bad0117e314375432b47e728f359df446123025399adb', 1786149568311
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1786149568311
);

-- 0016_organic_selene
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'e4c7dc4d13b911d67954ef2ce25fd608918c5463195fa675e2291752a48fe44b', 1786158485623
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1786158485623
);

-- 0017_rich_slayback
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '568be23e7ec00eead7568b8fdf48488c0b0e22779495280dc5dca5f0badab3a9', 1786168231443
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1786168231443
);

DROP FUNCTION drizzle.ensure_public_enum(text, text);

COMMIT;
