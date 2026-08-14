import { cron } from 'inngest'
import { lt } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'
import { logBusinessEvent } from '@/lib/logger'
import { adminAuditLogs } from '@/lib/schema'

export const ACTIVITY_RETENTION_MONTHS = 24

export const getActivityRetentionCutoff = (now = new Date()) =>
  new Date(
    Date.UTC(
      now.getUTCFullYear() - 2,
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    )
  )

export const deleteExpiredAdminAuditLogs = async (cutoff: Date) => {
  const deleted = await drizzleDb
    .delete(adminAuditLogs)
    .where(lt(adminAuditLogs.createdAt, cutoff))
    .returning({ id: adminAuditLogs.id })

  return deleted.length
}

export const activityRetentionFunction = inngest.createFunction(
  {
    id: 'activity-retention',
    name: 'Delete expired admin activity',
    triggers: [cron('0 4 1 * *')],
  },
  async ({ step }) => {
    const cutoff = getActivityRetentionCutoff()
    const deleted = await step.run('delete-expired-admin-activity', () =>
      deleteExpiredAdminAuditLogs(cutoff)
    )

    logBusinessEvent({
      event: 'cron_admin_activity_retention_completed',
      details: {
        deleted,
        cutoff: cutoff.toISOString(),
        retentionWindowMonths: ACTIVITY_RETENTION_MONTHS,
      },
      success: true,
    })

    return { deleted, cutoff: cutoff.toISOString() }
  }
)
