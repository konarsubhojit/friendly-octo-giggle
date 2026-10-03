/**
 * Hybrid relevance ranking for the PostgreSQL catalog search fallback.
 *
 * Two signals are combined into a single score:
 *
 *   ts_rank(catalog_search_vector(...), websearch_to_tsquery('english', $q))
 *                                                               * TS_RANK_WEIGHT
 *     + similarity(immutable_unaccent(name), immutable_unaccent($q))
 *                                                               * NAME_SIMILARITY_WEIGHT
 *
 * `ts_rank` runs over the indexed, weighted `catalog_search_vector` expression
 * (name = A, description = B, category = C), so a word that matches the name
 * already outranks the same word matched in a description. `similarity` from
 * `pg_trgm` is what makes typo tolerance real: "travle bag" never matches an
 * `ilike '%travle bag%'`, but it is well above the trigram threshold against
 * "Travel Bag".
 *
 * Weights: `ts_rank` for a single-term match against an `A`-weighted lexeme
 * lands around 0.06–0.1, while `similarity` for a close name match lands
 * around 0.4–0.8 — an order of magnitude apart. Scaling `ts_rank` by 10 puts
 * the two signals on a comparable 0–1 footing, and the name-similarity weight
 * of 2 then keeps a near-exact *name* match ahead of a body-text match that
 * merely happens to contain many query lexemes. That ordering is the one the
 * issue asks for ("weight name similarity above the full-text score") and it
 * is what a shopper typing a product name expects.
 *
 * `websearch_to_tsquery` (not `plainto_tsquery`) is used deliberately: it
 * supports quoted phrases and `-exclusion` and never raises a syntax error on
 * malformed input, so an arbitrary shopper query can be passed straight
 * through. Caveat: because the trigram branch is OR'd in, a `-term` exclusion
 * is honoured by the full-text branch but can still be re-admitted by a close
 * name match — exclusion is a ranking hint here, not a hard filter.
 *
 * `immutable_unaccent` folds accents before both full-text parsing and trigram
 * comparison, so "cafe" matches "café". The phase-2 migration wraps the
 * extension's stable function in immutable, schema-qualified functions,
 * allowing PostgreSQL to use expression indexes without rewriting the phase-1
 * generated column.
 *
 * Consumers of the ordering: `searchCatalog` in `src/lib/search-discovery.ts`
 * ranks by provider result *order* (`relevanceOrder`), not by the score field,
 * and `orderProductsByIdList` in the AI chat path does the same — both simply
 * inherit this ordering. `src/lib/search/product-search.ts` caches matched ids
 * for 60s; ranking is deterministic for a given catalog state, so a cached
 * ordering is only ever a slightly older ordering of the same query.
 */

import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { products } from '@/lib/schema'

/** Multiplier applied to `ts_rank`, which is an order of magnitude smaller than `similarity`. */
export const TS_RANK_WEIGHT = 10

/** Multiplier applied to trigram name similarity, kept above the full-text signal. */
export const NAME_SIMILARITY_WEIGHT = 2

/**
 * Minimum trigram similarity for a name-only (typo) match to be returned.
 * Matches the `pg_trgm.similarity_threshold` default so the index-backed `%`
 * operator and this explicit bound agree; asserting it explicitly keeps the
 * result set deterministic even if the session GUC has been changed. Lowering
 * it floods the results with unrelated products.
 */
export const TRIGRAM_MIN_SIMILARITY = 0.3

const rawNumber = (value: number) => sql.raw(value.toString())

export type RankedProductRow = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: string
  readonly image: string
  readonly score: number
}

/**
 * Build the relevance score expression and the match predicate for a query.
 * Exported so every Postgres-backed catalog search path shares one definition.
 */
export const buildCatalogRelevance = (query: string) => {
  const normalizedQuery = sql`public.immutable_unaccent(${query})`
  const tsQuery = sql`websearch_to_tsquery('english', ${normalizedQuery})`
  const searchVector = sql`public.catalog_search_vector(
    ${products.name}, ${products.description}, ${products.category}
  )`

  const score = sql<number>`(
    ts_rank(${searchVector}, ${tsQuery}) * ${rawNumber(TS_RANK_WEIGHT)}
    + similarity(public.immutable_unaccent(${products.name}), ${normalizedQuery})
      * ${rawNumber(NAME_SIMILARITY_WEIGHT)}
  )`

  const matches = or(
    sql`${searchVector} @@ ${tsQuery}`,
    // `%` is index-backed (idx_products_name_unaccent_trgm); the explicit
    // comparison pins the threshold independently of the session GUC.
    and(
      sql`public.immutable_unaccent(${products.name}) % ${normalizedQuery}`,
      sql`similarity(public.immutable_unaccent(${products.name}), ${normalizedQuery})
        >= ${rawNumber(TRIGRAM_MIN_SIMILARITY)}`
    ) as SQL
  ) as SQL

  return { score, matches }
}

/**
 * Run the hybrid ranked catalog query. Returns rows ordered by descending
 * relevance, with `createdAt` as a deterministic tie-breaker.
 */
export const searchRankedProducts = async (
  query: string,
  options: { readonly limit?: number; readonly category?: string } = {}
): Promise<RankedProductRow[]> => {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []

  const normalizedCategory = options.category?.trim() || undefined
  const { score, matches } = buildCatalogRelevance(normalizedQuery)

  const rows = await drizzleDb
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      image: products.image,
      score,
    })
    .from(products)
    .where(
      and(
        isNull(products.deletedAt),
        normalizedCategory
          ? eq(products.category, normalizedCategory)
          : undefined,
        matches
      )
    )
    .orderBy(desc(score), desc(products.createdAt))
    .limit(options.limit ?? 20)

  return rows.map((row) => ({ ...row, score: Number(row.score) }))
}
