import { cron } from 'inngest'
import { inngest } from '@/lib/inngest/client'

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
  const [{ lt }, { drizzleDb }, { adminAuditLogs }] = await Promise.all([
    import('drizzle-orm'),
    import('@/lib/db'),
    import('@/lib/schema'),
  ])
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

    const { logBusinessEvent } = await import('@/lib/logger')
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
