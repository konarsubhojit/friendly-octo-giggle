import { NextResponse } from 'next/server'
import { drizzleDb } from '@/lib/db'
import { categories } from '@/lib/schema'
import { isNull, asc } from 'drizzle-orm'
import { buildPublicCacheHeader } from '@/lib/cache'

export const revalidate = 60

export async function GET() {
  try {
    const list = await drizzleDb
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name))

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
