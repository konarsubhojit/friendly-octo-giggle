import { drizzleDb } from '@/lib/db'
import { failedEmails } from '@/lib/schema'
import type { EmailAttemptRecord } from '@/lib/schema'
import { eq, and, inArray, count, desc, asc } from 'drizzle-orm'
import { logError, logBusinessEvent } from '@/lib/logger'
import { sendEmail } from './providers'
import type { EmailMessage } from './providers'

export type EmailType = 'order_confirmation' | 'order_status_update'
export type FailedEmailStatus = 'pending' | 'failed' | 'sent'

export interface FailedEmail {
  readonly id: string
  readonly recipientEmail: string
  readonly subject: string
  readonly bodyHtml: string
  readonly bodyText: string
  readonly emailType: EmailType
  readonly referenceId: string
  readonly attemptCount: number
  readonly lastError: string | null
  readonly isRetriable: boolean
  readonly status: FailedEmailStatus
  readonly errorHistory: EmailAttemptRecord[]
  readonly createdAt: Date
  readonly lastAttemptedAt: Date | null
  readonly sentAt: Date | null
}

export interface SaveFailedEmailInput {
  readonly recipientEmail: string
  readonly subject: string
  readonly bodyHtml: string
  readonly bodyText: string
  readonly emailType: EmailType
  readonly referenceId: string
  readonly errorHistory: EmailAttemptRecord[]
  readonly isRetriable: boolean
  readonly attemptCount: number
  readonly lastError: string | null
}

export interface FailedEmailRetryResult {
  readonly id: string
  readonly success: boolean
  readonly error?: string
}

export interface GetFailedEmailsFilters {
  readonly statusList?: FailedEmailStatus[]
  readonly page?: number
  readonly pageSize?: number
  readonly sortOrder?: 'asc' | 'desc'
}

export interface GetFailedEmailsResult {
  readonly records: FailedEmail[]
  readonly total: number
}

export const saveFailedEmail = async (
  data: SaveFailedEmailInput
): Promise<string> => {
  const [row] = await drizzleDb
    .insert(failedEmails)
    .values({
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      bodyText: data.bodyText,
      emailType: data.emailType,
      referenceId: data.referenceId,
      errorHistory: data.errorHistory,
      isRetriable: data.isRetriable,
      attemptCount: data.attemptCount,
      lastError: data.lastError,
    })
    .returning({ id: failedEmails.id })

  logBusinessEvent({
    event: 'failed_email_saved',
    details: {
      id: row.id,
      emailType: data.emailType,
      referenceId: data.referenceId,
      attemptCount: data.attemptCount,
      isRetriable: data.isRetriable,
    },
    success: true,
  })

  return row.id
}

export const markFailedEmailSent = async (id: string): Promise<void> => {
  await drizzleDb
    .update(failedEmails)
    .set({ status: 'sent', sentAt: new Date() })
    .where(eq(failedEmails.id, id))
}

export const getFailedEmails = async (
  filters: GetFailedEmailsFilters = {}
): Promise<GetFailedEmailsResult> => {
  const {
    statusList = ['pending', 'failed'],
    page = 1,
    pageSize = 25,
    sortOrder = 'desc',
  } = filters

  const offset = (page - 1) * pageSize
  const orderDir = sortOrder === 'asc' ? asc : desc

  const whereCondition = inArray(failedEmails.status, statusList)

  const [rows, totalRows] = await Promise.all([
    drizzleDb
      .select()
      .from(failedEmails)
      .where(whereCondition)
      .orderBy(orderDir(failedEmails.createdAt))
      .limit(pageSize)
      .offset(offset),
    drizzleDb
      .select({ value: count() })
      .from(failedEmails)
      .where(whereCondition),
  ])

  const total = totalRows[0]?.value ?? 0

  return {
    records: rows as FailedEmail[],
    total,
  }
}

const persistRetrySuccess = async (
  id: string,
  attemptNumber: number
): Promise<void> => {
  await drizzleDb
    .update(failedEmails)
    .set({
      status: 'sent',
      sentAt: new Date(),
      lastAttemptedAt: new Date(),
      attemptCount: attemptNumber,
    })
    .where(eq(failedEmails.id, id))
  logBusinessEvent({
    event: 'failed_email_retry_success',
    details: { id, attemptNumber },
    success: true,
  })
}

const persistRetryError = async (
  id: string,
  error: unknown,
  attemptNumber: number,
  existingHistory: EmailAttemptRecord[] | null
): Promise<string> => {
  const errorMsg = error instanceof Error ? error.message : String(error)
  const newRecord: EmailAttemptRecord = {
    attempt: attemptNumber,
    timestamp: new Date().toISOString(),
    error: errorMsg,
    provider: 'unknown',
  }
  const updatedHistory = [...(existingHistory ?? []), newRecord]
  await drizzleDb
    .update(failedEmails)
    .set({
      status: 'failed',
      lastError: errorMsg,
      lastAttemptedAt: new Date(),
      attemptCount: attemptNumber,
      errorHistory: updatedHistory,
    })
    .where(eq(failedEmails.id, id))
  logError({
    error,
    context: 'failed_email_retry',
    additionalInfo: { id, attemptNumber },
  })
  return errorMsg
}

export const retryFailedEmail = async (
  id: string
): Promise<FailedEmailRetryResult> => {
  const record = await drizzleDb.query.failedEmails.findFirst({
    where: eq(failedEmails.id, id),
  })
  if (!record) return { id, success: false, error: 'Record not found' }
  if (record.status === 'sent') return { id, success: true }

  const msg: EmailMessage = {
    to: record.recipientEmail,
    subject: record.subject,
    html: record.bodyHtml,
    text: record.bodyText,
  }
  const attemptNumber = record.attemptCount + 1

  try {
    await sendEmail(msg)
    await persistRetrySuccess(id, attemptNumber)
    return { id, success: true }
  } catch (error) {
    const errorMsg = await persistRetryError(
      id,
      error,
      attemptNumber,
      record.errorHistory
    )
    return { id, success: false, error: errorMsg }
  }
}

export const batchRetryFailedEmails = async (
  ids: string[]
): Promise<FailedEmailRetryResult[]> => {
  const results = await Promise.allSettled(ids.map((id) => retryFailedEmail(id)))
  return results.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value
    return {
      id: ids[idx],
      success: false,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    }
  })
}

export const acknowledgePendingEmails = async (
  ids: string[]
): Promise<void> => {
  if (ids.length === 0) return
  await drizzleDb
    .update(failedEmails)
    .set({ status: 'failed' })
    .where(inArray(failedEmails.id, ids))
}

export const countPendingFailedEmails = async (): Promise<number> => {
  const rows = await drizzleDb
    .select({ value: count() })
    .from(failedEmails)
    .where(inArray(failedEmails.status, ['pending', 'failed']))
  return rows[0]?.value ?? 0
}

const MAX_CRON_RETRY_BATCH = 20
const MAX_CRON_RETRY_ATTEMPTS = 5

export const getRetriableFailedEmails = async (): Promise<FailedEmail[]> => {
  const rows = await drizzleDb
    .select()
    .from(failedEmails)
    .where(
      and(
        inArray(failedEmails.status, ['pending', 'failed']),
        eq(failedEmails.isRetriable, true)
      )
    )
    .orderBy(asc(failedEmails.createdAt))
    .limit(MAX_CRON_RETRY_BATCH)

  return rows.filter(
    (row) => row.attemptCount < MAX_CRON_RETRY_ATTEMPTS
  ) as FailedEmail[]
}

export type { EmailAttemptRecord } from '@/lib/schema'
