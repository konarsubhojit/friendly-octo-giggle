-- Promote the composite UNIQUE constraints on `VerificationToken` and
-- `ProductVariantOptionValue` to PRIMARY KEYs.
--
-- Both tables are covered by the `inngest` logical-replication publication,
-- which is created FOR ALL TABLES with `pubdelete = true`. Postgres refuses
-- any DELETE against a published table that has neither a primary key nor an
-- explicit replica identity, so every delete on these two tables failed with
-- "cannot delete from table ... because it does not have a replica identity".
--
-- The user-visible consequences were:
--   * `VerificationToken` — the Auth.js adapter deletes the row when a token
--     is redeemed, so email verification and password reset both failed at the
--     final step.
--   * `ProductVariantOptionValue` — re-assigning a variant's options deletes
--     the old links, so admin variant edits failed.
--
-- A primary key is preferable to `REPLICA IDENTITY USING INDEX`: it is the
-- default replica identity, it is what the Auth.js reference schema declares
-- for this table, and it needs no separate DDL to stay in effect.
--
-- The reset to `REPLICA IDENTITY DEFAULT` is defensive. Any environment where
-- this was already worked around by hand points its replica identity at the
-- index dropped immediately below; without the reset that drop would fail.
ALTER TABLE "ProductVariantOptionValue" REPLICA IDENTITY DEFAULT;--> statement-breakpoint
ALTER TABLE "VerificationToken" REPLICA IDENTITY DEFAULT;--> statement-breakpoint
ALTER TABLE "ProductVariantOptionValue" DROP CONSTRAINT "ProductVariantOptionValue_pk";--> statement-breakpoint
ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_identifier_token_key";--> statement-breakpoint
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_pk" PRIMARY KEY("variantId","optionValueId");--> statement-breakpoint
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_identifier_token_pk" PRIMARY KEY("identifier","token");