CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("category", '')), 'C')) STORED;--> statement-breakpoint
CREATE INDEX "idx_products_search_vector" ON "Product" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "idx_products_name_trgm" ON "Product" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_products_description_trgm" ON "Product" USING gin ("description" gin_trgm_ops);