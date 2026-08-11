import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { adminSavedViews, type AdminSavedViewCriteriaRecord } from '@/lib/schema'
import type { AdminPermission } from '@/lib/constants/roles'
import type {
  AdminResourceKey,
  CreateSavedViewRequest,
  RenameSavedViewRequest,
} from '@/lib/validations/admin'
import { seedBuiltInAdminSavedViews } from './admin-saved-view-seed'
import { ADMIN_RESOURCE_READ_PERMISSIONS } from './admin-resource-permissions'

export interface SavedViewRecord {
  readonly id: string
  readonly resource: AdminResourceKey
  readonly name: string
  readonly criteria: Record<string, unknown>
  readonly isBuiltIn: boolean
  readonly owned: boolean
}

interface VisibleSavedViewRow {
  readonly id: string
  readonly ownerId: string | null
  readonly resource: string
  readonly name: string
  readonly criteria: Record<string, unknown>
  readonly isBuiltIn: boolean
  readonly requiredPermission: AdminPermission | null
}

export const isSavedViewVisibleToUser = (
  row: VisibleSavedViewRow,
  userId: string,
  permissions: readonly AdminPermission[]
): boolean => {
  if (row.ownerId === userId) {
    return true
  }

  return (
    row.isBuiltIn &&
    row.requiredPermission !== null &&
    permissions.includes(row.requiredPermission)
  )
}

const toSavedViewRecord = (
  row: VisibleSavedViewRow,
  userId: string
): SavedViewRecord => ({
  id: row.id,
  resource: row.resource as AdminResourceKey,
  name: row.name,
  criteria: row.criteria,
  isBuiltIn: row.isBuiltIn,
  owned: row.ownerId === userId,
})

const toCriteriaRecord = (
  criteria: AdminSavedViewCriteriaRecord
): Record<string, unknown> =>
  JSON.parse(JSON.stringify(criteria)) as Record<string, unknown>

export const listSavedViews = async ({
  userId,
  permissions,
  resource,
}: {
  readonly userId: string
  readonly permissions: readonly AdminPermission[]
  readonly resource: AdminResourceKey
}): Promise<readonly SavedViewRecord[]> => {
  await seedBuiltInAdminSavedViews()

  const builtInPermissions = permissions.filter(
    (permission) => permission === ADMIN_RESOURCE_READ_PERMISSIONS[resource]
  )

  const rows = await primaryDrizzleDb.query.adminSavedViews.findMany({
    where: or(
      and(
        eq(adminSavedViews.resource, resource),
        eq(adminSavedViews.ownerId, userId)
      ),
      builtInPermissions.length > 0
        ? and(
            eq(adminSavedViews.resource, resource),
            eq(adminSavedViews.isBuiltIn, true),
            inArray(adminSavedViews.requiredPermission, builtInPermissions)
          )
        : and(
            eq(adminSavedViews.resource, resource),
            eq(adminSavedViews.isBuiltIn, false),
            eq(adminSavedViews.ownerId, userId)
          )
    ),
    orderBy: (table, { asc, desc }) => [
      desc(table.isBuiltIn),
      asc(table.name),
      asc(table.createdAt),
    ],
  })

  return rows
    .filter((row) =>
      isSavedViewVisibleToUser(
        {
          ...(row as unknown as VisibleSavedViewRow),
          criteria: toCriteriaRecord(row.criteria),
        },
        userId,
        permissions
      )
    )
    .map((row) =>
      toSavedViewRecord(
        {
          ...(row as unknown as VisibleSavedViewRow),
          criteria: toCriteriaRecord(row.criteria),
        },
        userId
      )
    )
}

export const createSavedView = async ({
  userId,
  resource,
  input,
}: {
  readonly userId: string
  readonly resource: AdminResourceKey
  readonly input: CreateSavedViewRequest
}): Promise<SavedViewRecord> => {
  const [created] = await primaryDrizzleDb
    .insert(adminSavedViews)
    .values({
      ownerId: userId,
      resource,
      name: input.name,
      criteria: input.criteria,
      isBuiltIn: false,
      requiredPermission: null,
      updatedAt: new Date(),
    })
    .returning()

  return toSavedViewRecord(
    {
      ...(created as unknown as VisibleSavedViewRow),
      criteria: toCriteriaRecord(created.criteria),
    },
    userId
  )
}

export const getOwnedSavedViewById = async ({
  id,
  userId,
}: {
  readonly id: string
  readonly userId: string
}) =>
  primaryDrizzleDb.query.adminSavedViews.findFirst({
    where: and(
      eq(adminSavedViews.id, id),
      eq(adminSavedViews.ownerId, userId),
      eq(adminSavedViews.isBuiltIn, false)
    ),
  })

export const renameSavedView = async ({
  id,
  userId,
  input,
}: {
  readonly id: string
  readonly userId: string
  readonly input: RenameSavedViewRequest
}): Promise<SavedViewRecord | null> => {
  const [updated] = await primaryDrizzleDb
    .update(adminSavedViews)
    .set({
      name: input.name,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(adminSavedViews.id, id),
        eq(adminSavedViews.ownerId, userId),
        eq(adminSavedViews.isBuiltIn, false)
      )
    )
    .returning()

  if (!updated) {
    return null
  }

  return toSavedViewRecord(
    {
      ...(updated as unknown as VisibleSavedViewRow),
      criteria: toCriteriaRecord(updated.criteria),
    },
    userId
  )
}

export const deleteSavedView = async ({
  id,
  userId,
}: {
  readonly id: string
  readonly userId: string
}) => {
  const deleted = await primaryDrizzleDb
    .delete(adminSavedViews)
    .where(
      and(
        eq(adminSavedViews.id, id),
        eq(adminSavedViews.ownerId, userId),
        eq(adminSavedViews.isBuiltIn, false),
        isNull(adminSavedViews.requiredPermission)
      )
    )
    .returning({ id: adminSavedViews.id })

  return deleted.length > 0
}
