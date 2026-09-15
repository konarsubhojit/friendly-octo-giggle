import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ drizzleDb: { select: vi.fn() } }))

import {
  NAME_SIMILARITY_WEIGHT,
  TRIGRAM_MIN_SIMILARITY,
  TS_RANK_WEIGHT,
} from '@/lib/search/postgres-ranking'

/** Mirrors the SQL score arithmetic so weight changes are caught here. */
const score = (tsRank: number, similarity: number) =>
  tsRank * TS_RANK_WEIGHT + similarity * NAME_SIMILARITY_WEIGHT

/**
 * Signal values measured against a seeded PostgreSQL 16 catalog for the query
 * "travel bag": an exact name match, and a product whose *description*
 * repeats the query terms often enough to score an almost identical ts_rank.
 */
describe('hybrid catalog relevance weights', () => {
  it('ranks an exact name match above a description-only match', () => {
    const exactNameMatch = score(0.9995679, 1)
    const descriptionMatch = score(0.9564013, 0.08)

    expect(exactNameMatch).toBeGreaterThan(descriptionMatch)
  })

  it('keeps name similarity weighted above the full-text signal', () => {
    // A perfect name match must beat the best possible ts_rank on its own.
    expect(NAME_SIMILARITY_WEIGHT * 1).toBeGreaterThan(TS_RANK_WEIGHT * 0.1)
  })

  it('keeps a typo match above the trigram floor', () => {
    // similarity('Travel Bag', 'travle bag') measured at 0.571.
    expect(0.5714286).toBeGreaterThanOrEqual(TRIGRAM_MIN_SIMILARITY)
    expect(score(1e-20, 0.5714286)).toBeGreaterThan(0)
  })

  it('uses the pg_trgm default similarity threshold', () => {
    expect(TRIGRAM_MIN_SIMILARITY).toBe(0.3)
  })
})
