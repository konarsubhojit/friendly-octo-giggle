import { drizzleDb } from '@/lib/db'
import { adminAuditLogs } from '@/lib/schema'

interface AdminAuditLogInput {
  readonly userId: string
  readonly entity: string
  readonly entityId: string
  readonly action: string
  readonly diff?: Record<string, unknown>
}

export const recordAdminAuditLog = async ({
  userId,
  entity,
  entityId,
  action,
  diff = {},
}: AdminAuditLogInput): Promise<void> => {
  if (!userId || !entity || !entityId || !action) {
    return
  }

  await drizzleDb.insert(adminAuditLogs).values({
    userId,
    entity,
    entityId,
    action,
    diff,
  })
}
