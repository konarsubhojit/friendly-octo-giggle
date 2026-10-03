import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('@/lib/db', () => ({
  drizzleDb: { select: mockSelect },
}))

import { PostgresCatalogSearchClient } from '@/lib/search/postgres-adapter'
import { TRIGRAM_MIN_SIMILARITY } from '@/lib/search/postgres-ranking'

type CapturedQuery = {
  fields: Record<string, unknown>
  where: SQL
  orderBy: SQL[]
  limit: number
}

const dialect = new PgDialect()
const render = (fragment: SQL) => dialect.sqlToQuery(fragment).sql

let captured: CapturedQuery
let rows: Array<Record<string, unknown>>

const installSelectChain = () => {
  mockSelect.mockImplementation((fields: Record<string, unknown>) => {
    captured = {
      fields,
      where: undefined as unknown as SQL,
      orderBy: [],
      limit: 0,
    }
    const builder = {
      from: () => builder,
      where: (where: SQL) => {
        captured.where = where
        return builder
      },
      orderBy: (...orderBy: SQL[]) => {
        captured.orderBy = orderBy
        return builder
      },
      limit: (limit: number) => {
        captured.limit = limit
        return Promise.resolve(rows)
      },
    }
    return builder
  })
}

const client = new PostgresCatalogSearchClient()

describe('PostgresCatalogSearchClient.searchProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rows = []
    installSelectChain()
  })

  it('reports typo tolerance now that similarity() backs the query', () => {
    expect(client.capabilities()).toEqual({
      provider: 'postgres',
      typoTolerance: true,
      facets: false,
      highlighting: false,
      suggestions: false,
      rankingModes: ['relevance'],
    })
  })

  it('ranks with websearch_to_tsquery and trigram similarity', async () => {
    await client.searchProducts('cafe bag')

    const score = render(captured.fields.score as SQL)
    expect(score).toContain('ts_rank')
    expect(score).toContain("websearch_to_tsquery('english'")
    expect(score).toContain('similarity')
    expect(score).toContain('public.immutable_unaccent')
    expect(score).toContain('public.catalog_search_vector')
    expect(render(captured.orderBy[0])).toContain('ts_rank')
  })

  it('excludes soft-deleted products and bounds trigram matches', async () => {
    await client.searchProducts('travel bag')

    const where = render(captured.where)
    expect(where).toContain('"deletedAt" is null')
    expect(where).toContain('@@ websearch_to_tsquery')
    expect(where).toContain('public.catalog_search_vector')
    expect(where).toContain(`>= ${TRIGRAM_MIN_SIMILARITY}`)
    expect(where).not.toContain('"category" =')
  })

  it('still applies the optional category filter', async () => {
    await client.searchProducts('travel bag', { category: ' bags ' })

    expect(render(captured.where)).toContain('"category" =')
  })

  it('applies the requested limit and defaults to 20', async () => {
    await client.searchProducts('travel bag', { limit: 5 })
    expect(captured.limit).toBe(5)

    await client.searchProducts('travel bag')
    expect(captured.limit).toBe(20)
  })

  it('returns per-row relevance scores instead of a constant 1', async () => {
    rows = [
      {
        id: 'p1',
        name: 'Travel Bag',
        description: 'A durable bag',
        category: 'bags',
        image: '/a.webp',
        score: 11.99,
      },
      {
        id: 'p2',
        name: 'Weekend Backpack',
        description: 'Great to travel with a bag',
        category: 'bags',
        image: '/b.webp',
        score: 9.72,
      },
    ]

    const results = await client.searchProducts('travel bag')

    expect(results).toEqual([
      {
        id: 'p1',
        score: 11.99,
        content: {
          name: 'Travel Bag',
          description: 'A durable bag',
          category: 'bags',
        },
        metadata: { image: '/a.webp' },
      },
      {
        id: 'p2',
        score: 9.72,
        content: {
          name: 'Weekend Backpack',
          description: 'Great to travel with a bag',
          category: 'bags',
        },
        metadata: { image: '/b.webp' },
      },
    ])
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('does not query for a blank search term', async () => {
    expect(await client.searchProducts('   ')).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })
})
