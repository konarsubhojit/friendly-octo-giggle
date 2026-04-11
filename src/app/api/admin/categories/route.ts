import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { auth } from '@/lib/auth'
import { drizzleDb } from '@/lib/db'
import { categories } from '@/lib/schema'
import { isNull, asc, eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  sortOrder: z.number().int().min(0).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return apiError('Not authenticated', 401)
  if (session.user.role !== 'ADMIN') return apiError('Not authorized', 403)

  try {
    const list = await drizzleDb
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name))

    return apiSuccess(
      {
        categories: list.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      },
      200,
      {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=10',
      }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return apiError('Not authenticated', 401)
  if (session.user.role !== 'ADMIN') return apiError('Not authorized', 403)

  try {
    const body = await request.json()
    const parsed = CreateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400)
    }

    const { name, sortOrder } = parsed.data

    const existing = await drizzleDb
      .select()
      .from(categories)
      .where(eq(categories.name, name.trim()))
      .limit(1)

    if (existing.length > 0) {
      const cat = existing[0]
      if (cat.deletedAt) {
        const [reactivated] = await drizzleDb
          .update(categories)
          .set({
            deletedAt: null,
            updatedAt: new Date(),
            sortOrder: sortOrder ?? cat.sortOrder,
          })
          .where(eq(categories.id, cat.id))
          .returning()

        return apiSuccess(
          {
            category: {
              ...reactivated,
              createdAt: reactivated.createdAt.toISOString(),
              updatedAt: reactivated.updatedAt.toISOString(),
              deletedAt: null,
            },
          },
          201
        )
      }
      return apiError('A category with this name already exists', 409)
    }

    const [created] = await drizzleDb
      .insert(categories)
      .values({ name: name.trim(), sortOrder: sortOrder ?? 0 })
      .returning()

    return apiSuccess(
      {
        category: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          deletedAt: null,
        },
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
