import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { drizzleDb } from '@/lib/db'
import { categories } from '@/lib/schema'
import { isNull, asc } from 'drizzle-orm'
import { buildPublicCacheHeader } from '@/lib/cache'
import { categoriesTag } from '@/lib/cache-tags'

/**
 * Cached taxonomy read.
 *
 * Categories change rarely and identically for every visitor, so the query is
 * served from the data cache and invalidated by `categoriesTag()` whenever an
 * admin creates, updates, deletes, or reorders a category. The `Cache-Control`
 * header below is unchanged so CDN and browser behaviour stay the same.
 */
async function getCachedCategories() {
  'use cache'
  cacheLife('taxonomy')
  cacheTag(categoriesTag())

  return drizzleDb
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
}

export async function GET() {
  try {
    const list = await getCachedCategories()

    return NextResponse.json(
      { data: list },
      {
        headers: {
          'Cache-Control': buildPublicCacheHeader(60),
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}
