import { drizzleDb } from '@/lib/db'
import { adminAuditLogs } from '@/lib/schema'
import { isUserRole, type UserRole } from '@/lib/constants/roles'

interface AdminAuditLogInput {
  readonly userId: string
  /** Role the actor held when performing the action. */
  readonly role?: UserRole | null
  readonly entity: string
  readonly entityId: string
  readonly action: string
  readonly diff?: Record<string, unknown>
}

export const recordAdminAuditLog = async ({
  userId,
  role,
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
    role: isUserRole(role) ? role : null,
    entity,
    entityId,
    action,
    diff,
  })
}
