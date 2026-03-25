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

SELECT drizzle.ensure_public_enum(
  'OrderStatus',
  'CREATE TYPE public."OrderStatus" AS ENUM (''PENDING'', ''PROCESSING'', ''SHIPPED'', ''DELIVERED'', ''CANCELLED'')'
);

SELECT drizzle.ensure_public_enum(
  'UserRole',
  'CREATE TYPE public."UserRole" AS ENUM (''CUSTOMER'', ''ADMIN'')'
);

SELECT drizzle.ensure_public_enum(
  'CheckoutRequestStatus',
  'CREATE TYPE public."CheckoutRequestStatus" AS ENUM (''PENDING'', ''PROCESSING'', ''COMPLETED'', ''FAILED'')'
);

SELECT drizzle.ensure_public_enum(
  'EmailType',
  'CREATE TYPE public."EmailType" AS ENUM (''order_confirmation'', ''order_status_update'')'
);

SELECT drizzle.ensure_public_enum(
  'FailedEmailStatus',
  'CREATE TYPE public."FailedEmailStatus" AS ENUM (''pending'', ''failed'', ''sent'')'
);

CREATE TABLE IF NOT EXISTS public."User" (
  id text PRIMARY KEY NOT NULL,
  "name" text,
  email text NOT NULL,
  "emailVerified" timestamp,
  image text,
  "passwordHash" text,
  "phoneNumber" varchar(20),
  role public."UserRole" DEFAULT 'CUSTOMER' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "currencyPreference" varchar(3) DEFAULT 'INR' NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Account" (
  id text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text
);

CREATE TABLE IF NOT EXISTS public."Session" (
  "sessionToken" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  expires timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS public."VerificationToken" (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS public."PasswordHistory" (
  id text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "passwordHash" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Category" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);

CREATE TABLE IF NOT EXISTS public."Product" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  description text NOT NULL,
  price double precision NOT NULL,
  image text NOT NULL,
  images json DEFAULT '[]'::json NOT NULL,
  stock integer NOT NULL,
  category text NOT NULL,
  "deletedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."ProductVariation" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "productId" varchar(7) NOT NULL,
  "name" text NOT NULL,
  "designName" text NOT NULL,
  image text,
  images json DEFAULT '[]'::json NOT NULL,
  "priceModifier" double precision DEFAULT 0 NOT NULL,
  stock integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);

CREATE TABLE IF NOT EXISTS public."ProductShare" (
  key varchar(7) PRIMARY KEY NOT NULL,
  "productId" varchar(7) NOT NULL,
  "variationId" varchar(7),
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Cart" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "userId" text,
  "sessionId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."CartItem" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "cartId" varchar(7) NOT NULL,
  "productId" varchar(7) NOT NULL,
  "variationId" varchar(7),
  quantity integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."CheckoutRequest" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "customerName" text NOT NULL,
  "customerEmail" text NOT NULL,
  "customerAddress" text NOT NULL,
  items json NOT NULL,
  status public."CheckoutRequestStatus" DEFAULT 'PENDING' NOT NULL,
  "errorMessage" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Order" (
  id varchar(10) PRIMARY KEY NOT NULL,
  "userId" text,
  "customerName" text NOT NULL,
  "customerEmail" text NOT NULL,
  "customerAddress" text NOT NULL,
  "totalAmount" double precision NOT NULL,
  status public."OrderStatus" DEFAULT 'PENDING' NOT NULL,
  "trackingNumber" text,
  "shippingProvider" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "checkoutRequestId" varchar(7)
);

CREATE TABLE IF NOT EXISTS public."OrderItem" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "orderId" varchar(10) NOT NULL,
  "productId" varchar(7) NOT NULL,
  "variationId" varchar(7),
  quantity integer NOT NULL,
  price double precision NOT NULL,
  "customizationNote" text
);

CREATE TABLE IF NOT EXISTS public."Review" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "productId" varchar(7) NOT NULL,
  "orderId" varchar(10),
  "userId" text,
  rating integer NOT NULL,
  comment text NOT NULL,
  "isAnonymous" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Wishlist" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "productId" varchar(7) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."FailedEmail" (
  id varchar(7) PRIMARY KEY NOT NULL,
  "recipientEmail" text NOT NULL,
  subject text NOT NULL,
  "bodyHtml" text NOT NULL,
  "bodyText" text NOT NULL,
  "emailType" public."EmailType" NOT NULL,
  "referenceId" varchar(7) NOT NULL,
  "attemptCount" integer DEFAULT 0 NOT NULL,
  "lastError" text,
  "isRetriable" boolean DEFAULT true NOT NULL,
  status public."FailedEmailStatus" DEFAULT 'pending' NOT NULL,
  "errorHistory" json DEFAULT '[]'::json NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "lastAttemptedAt" timestamp,
  "sentAt" timestamp
);

ALTER TABLE public."OrderItem"
  ALTER COLUMN "orderId" TYPE varchar(10);

ALTER TABLE public."Order"
  ALTER COLUMN id TYPE varchar(10);

ALTER TABLE public."Review"
  ALTER COLUMN "orderId" TYPE varchar(10);

ALTER TABLE public."Order"
  ADD COLUMN IF NOT EXISTS "checkoutRequestId" varchar(7);

ALTER TABLE public."ProductVariation"
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;

ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "currencyPreference" varchar(3) DEFAULT 'INR';

ALTER TABLE public."User"
  ALTER COLUMN "currencyPreference" SET DEFAULT 'INR';

UPDATE public."User"
SET "currencyPreference" = 'INR'
WHERE "currencyPreference" IS NULL;

ALTER TABLE public."User"
  ALTER COLUMN "currencyPreference" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_provider_providerAccountId_key') THEN
    ALTER TABLE public."Account" ADD CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE (provider, "providerAccountId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CartItem_cartId_productId_variationId_key') THEN
    ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_cartId_productId_variationId_key" UNIQUE ("cartId", "productId", "variationId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cart_userId_unique') THEN
    ALTER TABLE public."Cart" ADD CONSTRAINT "Cart_userId_unique" UNIQUE ("userId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cart_sessionId_unique') THEN
    ALTER TABLE public."Cart" ADD CONSTRAINT "Cart_sessionId_unique" UNIQUE ("sessionId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariation_productId_name_key') THEN
    ALTER TABLE public."ProductVariation" ADD CONSTRAINT "ProductVariation_productId_name_key" UNIQUE ("productId", "name");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_userId_productId_key') THEN
    ALTER TABLE public."Review" ADD CONSTRAINT "Review_userId_productId_key" UNIQUE ("userId", "productId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_email_unique') THEN
    ALTER TABLE public."User" ADD CONSTRAINT "User_email_unique" UNIQUE (email);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_phoneNumber_unique') THEN
    ALTER TABLE public."User" ADD CONSTRAINT "User_phoneNumber_unique" UNIQUE ("phoneNumber");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationToken_token_unique') THEN
    ALTER TABLE public."VerificationToken" ADD CONSTRAINT "VerificationToken_token_unique" UNIQUE (token);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationToken_identifier_token_key') THEN
    ALTER TABLE public."VerificationToken" ADD CONSTRAINT "VerificationToken_identifier_token_key" UNIQUE (identifier, token);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Wishlist_userId_productId_key') THEN
    ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_userId_productId_key" UNIQUE ("userId", "productId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_name_unique') THEN
    ALTER TABLE public."Category" ADD CONSTRAINT "Category_name_unique" UNIQUE ("name");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_checkoutRequestId_key') THEN
    ALTER TABLE public."Order" ADD CONSTRAINT "Order_checkoutRequestId_key" UNIQUE ("checkoutRequestId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_User_id_fk') THEN
    ALTER TABLE public."Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CartItem_cartId_Cart_id_fk') THEN
    ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES public."Cart"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CartItem_productId_Product_id_fk') THEN
    ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON DELETE no action ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CartItem_variationId_ProductVariation_id_fk') THEN
    ALTER TABLE public."CartItem" ADD CONSTRAINT "CartItem_variationId_ProductVariation_id_fk" FOREIGN KEY ("variationId") REFERENCES public."ProductVariation"(id) ON DELETE no action ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cart_userId_User_id_fk') THEN
    ALTER TABLE public."Cart" ADD CONSTRAINT "Cart_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_orderId_Order_id_fk') THEN
    ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_productId_Product_id_fk') THEN
    ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON DELETE no action ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_variationId_ProductVariation_id_fk') THEN
    ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_variationId_ProductVariation_id_fk" FOREIGN KEY ("variationId") REFERENCES public."ProductVariation"(id) ON DELETE no action ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_userId_User_id_fk') THEN
    ALTER TABLE public."Order" ADD CONSTRAINT "Order_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE no action ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordHistory_userId_User_id_fk') THEN
    ALTER TABLE public."PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductShare_productId_Product_id_fk') THEN
    ALTER TABLE public."ProductShare" ADD CONSTRAINT "ProductShare_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductShare_variationId_ProductVariation_id_fk') THEN
    ALTER TABLE public."ProductShare" ADD CONSTRAINT "ProductShare_variationId_ProductVariation_id_fk" FOREIGN KEY ("variationId") REFERENCES public."ProductVariation"(id) ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariation_productId_Product_id_fk') THEN
    ALTER TABLE public."ProductVariation" ADD CONSTRAINT "ProductVariation_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_productId_Product_id_fk') THEN
    ALTER TABLE public."Review" ADD CONSTRAINT "Review_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_orderId_Order_id_fk') THEN
    ALTER TABLE public."Review" ADD CONSTRAINT "Review_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_userId_User_id_fk') THEN
    ALTER TABLE public."Review" ADD CONSTRAINT "Review_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_User_id_fk') THEN
    ALTER TABLE public."Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Wishlist_userId_User_id_fk') THEN
    ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Wishlist_productId_Product_id_fk') THEN
    ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CheckoutRequest_userId_User_id_fk') THEN
    ALTER TABLE public."CheckoutRequest" ADD CONSTRAINT "CheckoutRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_checkoutRequestId_CheckoutRequest_id_fk') THEN
    ALTER TABLE public."Order" ADD CONSTRAINT "Order_checkoutRequestId_CheckoutRequest_id_fk" FOREIGN KEY ("checkoutRequestId") REFERENCES public."CheckoutRequest"(id) ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON public."Account" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "CartItem_cartId_idx" ON public."CartItem" USING btree ("cartId");
CREATE INDEX IF NOT EXISTS "CartItem_productId_idx" ON public."CartItem" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "CartItem_variationId_idx" ON public."CartItem" USING btree ("variationId");
CREATE INDEX IF NOT EXISTS "Cart_sessionId_idx" ON public."Cart" USING btree ("sessionId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON public."OrderItem" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_variationId_idx" ON public."OrderItem" USING btree ("variationId");
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON public."Order" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "PasswordHistory_userId_idx" ON public."PasswordHistory" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "ProductShare_productId_idx" ON public."ProductShare" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "ProductShare_variationId_idx" ON public."ProductShare" USING btree ("variationId");
CREATE INDEX IF NOT EXISTS "ProductVariation_productId_idx" ON public."ProductVariation" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON public."Product" USING btree (category);
CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON public."Review" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON public."Review" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON public."Session" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "Wishlist_userId_idx" ON public."Wishlist" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "CheckoutRequest_userId_idx" ON public."CheckoutRequest" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "CheckoutRequest_status_idx" ON public."CheckoutRequest" USING btree (status);
CREATE INDEX IF NOT EXISTS "CheckoutRequest_createdAt_idx" ON public."CheckoutRequest" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "FailedEmail_status_idx" ON public."FailedEmail" USING btree (status);
CREATE INDEX IF NOT EXISTS "FailedEmail_referenceId_idx" ON public."FailedEmail" USING btree ("referenceId");
CREATE INDEX IF NOT EXISTS "FailedEmail_createdAt_idx" ON public."FailedEmail" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON public."Order" USING btree (status);
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON public."Product" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "Product_deletedAt_idx" ON public."Product" USING btree ("deletedAt");

UPDATE drizzle.__drizzle_migrations
SET hash = 'd93aa197d881a0ed6e53efd815b572ae17bf5718ecdf45634cc476eec6fbb732'
WHERE created_at = 1774355279555;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'd93aa197d881a0ed6e53efd815b572ae17bf5718ecdf45634cc476eec6fbb732', 1774355279555
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1774355279555
);

UPDATE drizzle.__drizzle_migrations
SET hash = '3c69e516a03a9ae4c594d64e857c4ce6c04e7f59f38f696c773207c40c869e01'
WHERE created_at = 1774378815410;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '3c69e516a03a9ae4c594d64e857c4ce6c04e7f59f38f696c773207c40c869e01', 1774378815410
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1774378815410
);

DROP FUNCTION drizzle.ensure_public_enum(text, text);

COMMIT;