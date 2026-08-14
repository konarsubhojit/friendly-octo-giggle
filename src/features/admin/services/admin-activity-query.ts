import { and, eq, gt, inArray, lt, or, type SQL } from 'drizzle-orm'
import type { AdminPermission } from '@/lib/constants/roles'
import { drizzleDb } from '@/lib/db'
import { adminAuditLogs } from '@/lib/schema'
import type { AdminActivityQuery } from '@/lib/validations/admin'
import {
  ACTIVITY_ENTITY_PERMISSIONS,
  getActivityEntityPermission,
} from './admin-resource-permissions'

export interface ActivityChange {
  readonly field: string
  readonly before: unknown
  readonly after: unknown
}

export interface ActivityEntry {
  readonly id: string
  readonly entity: string
  readonly entityId: string
  readonly action: string
  readonly actor: {
    readonly userId: string
    readonly role: string | null
  }
  readonly changes: readonly ActivityChange[]
  readonly createdAt: string
}

interface ActivityQueryResult {
  readonly entries: readonly ActivityEntry[]
  readonly nextCursor: string | null
}

interface ActivityCursor {
  readonly createdAt: string
  readonly id: string
}

const asChangeRecord = (
  value: unknown
): value is { before?: unknown; after?: unknown } =>
  typeof value === 'object' &&
  value !== null &&
  ('before' in value || 'after' in value)

export const normalizeActivityChanges = (
  diff: Record<string, unknown>
): readonly ActivityChange[] =>
  Object.entries(diff).map(([field, value]) =>
    asChangeRecord(value)
      ? {
          field,
          before: value.before ?? null,
          after: value.after ?? null,
        }
      : {
          field,
          before: null,
          after: value,
        }
  )

const encodeCursor = (cursor: ActivityCursor) =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')

const decodeCursor = (cursor: string): ActivityCursor | null => {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as Partial<ActivityCursor>
    if (
      typeof parsed.createdAt === 'string' &&
      typeof parsed.id === 'string' &&
      !Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      return {
        createdAt: parsed.createdAt,
        id: parsed.id,
      }
    }
  } catch {}

  return null
}

/**
 * Every activity entity type the caller's permission set allows them to
 * read, per `ACTIVITY_ENTITY_PERMISSIONS` (FR-D09). Exported as a pure
 * function so the entity-scoping rule that ultimately builds the SQL
 * `WHERE` clause below is directly unit-testable without a database
 * (acceptance scenario 6: a viewer without permission to read an entity
 * type receives no records for that type from the global activity view).
 */
export const getAllowedActivityEntities = (
  permissions: readonly AdminPermission[]
): readonly string[] =>
  Object.entries(ACTIVITY_ENTITY_PERMISSIONS)
    .filter(([, permission]) => permissions.includes(permission))
    .map(([entity]) => entity)

const buildPermissionScopedEntityFilter = (
  permissions: readonly AdminPermission[]
): SQL | undefined => {
  const allowedEntities = getAllowedActivityEntities(permissions)

  return allowedEntities.length > 0
    ? inArray(adminAuditLogs.entity, allowedEntities)
    : eq(adminAuditLogs.entity, '__never__')
}

const buildWhereClause = (
  query: AdminActivityQuery,
  permissions: readonly AdminPermission[]
) => {
  const permissionFilter = buildPermissionScopedEntityFilter(permissions)
  const clauses: SQL[] = permissionFilter ? [permissionFilter] : []

  if (query.entity) {
    clauses.push(eq(adminAuditLogs.entity, query.entity))
  }

  if (query.entityId) {
    clauses.push(eq(adminAuditLogs.entityId, query.entityId))
  }

  if (query.action) {
    clauses.push(eq(adminAuditLogs.action, query.action))
  }

  if (query.actorId) {
    clauses.push(eq(adminAuditLogs.userId, query.actorId))
  }

  if (query.dateFrom) {
    clauses.push(gt(adminAuditLogs.createdAt, new Date(query.dateFrom)))
  }

  if (query.dateTo) {
    clauses.push(lt(adminAuditLogs.createdAt, new Date(query.dateTo)))
  }

  const decodedCursor = query.cursor ? decodeCursor(query.cursor) : null
  if (decodedCursor) {
    const cursorDate = new Date(decodedCursor.createdAt)
    clauses.push(
      or(
        lt(adminAuditLogs.createdAt, cursorDate),
        and(
          eq(adminAuditLogs.createdAt, cursorDate),
          lt(adminAuditLogs.id, decodedCursor.id)
        )
      )!
    )
  }

  return and(...clauses)
}

const mapEntry = (row: typeof adminAuditLogs.$inferSelect): ActivityEntry => ({
  id: row.id,
  entity: row.entity,
  entityId: row.entityId,
  action: row.action,
  actor: {
    userId: row.userId,
    role: row.role,
  },
  changes: normalizeActivityChanges(row.diff ?? {}),
  createdAt: row.createdAt.toISOString(),
})

export const queryAdminActivity = async ({
  query,
  permissions,
}: {
  readonly query: AdminActivityQuery
  readonly permissions: readonly AdminPermission[]
}): Promise<ActivityQueryResult> => {
  const rows = await drizzleDb.query.adminAuditLogs.findMany({
    where: buildWhereClause(query, permissions),
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    limit: query.limit + 1,
  })

  const page = rows.slice(0, query.limit)
  const last = page.at(-1)

  return {
    entries: page.map(mapEntry),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null,
  }
}

export const queryEntityActivity = async ({
  entity,
  entityId,
  limit = 25,
  cursor,
  permissions,
}: {
  readonly entity: string
  readonly entityId: string
  readonly limit?: number
  readonly cursor?: string
  readonly permissions: readonly AdminPermission[]
}): Promise<ActivityQueryResult> =>
  queryAdminActivity({
    query: {
      entity,
      entityId,
      limit,
      cursor,
    },
    permissions,
  })

export const getActivityRequiredPermission = (entity?: string) =>
  entity ? getActivityEntityPermission(entity) : 'system:manage'
