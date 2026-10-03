CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
SET search_path = ''
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint
CREATE FUNCTION public.catalog_search_vector(text, text, text)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
SET search_path = ''
AS $$
  SELECT
    setweight(to_tsvector('english', public.immutable_unaccent($1)), 'A') ||
    setweight(to_tsvector('english', public.immutable_unaccent($2)), 'B') ||
    setweight(to_tsvector('english', public.immutable_unaccent($3)), 'C')
$$;--> statement-breakpoint
CREATE INDEX "idx_products_unaccent_search_vector" ON "Product" USING gin (public.catalog_search_vector("name", "description", "category"));--> statement-breakpoint
CREATE INDEX "idx_products_name_unaccent_trgm" ON "Product" USING gin (public.immutable_unaccent("name") gin_trgm_ops);