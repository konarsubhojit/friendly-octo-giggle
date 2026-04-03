import { waitUntil } from '@vercel/functions'
import { logError, logBusinessEvent } from '@/lib/logger'
import { sendEmail } from './providers'
import type { EmailMessage } from './providers'
import { saveFailedEmail } from './failed-emails'
import type { EmailAttemptRecord, EmailType } from './failed-emails'

export interface RetryContext {
  readonly emailType: EmailType
  readonly referenceId?: string
}

const NON_RETRIABLE_CODES = new Set([401, 403])
const NON_RETRIABLE_STRINGS = [
  'eauth',
  'eenvelope',
  'invalid address',
  'invalid email',
  '550 5.1.1',
  'unknown user',
  'no such user',
  'user unknown',
  'does not exist',
]

type MailerSendLikeError = Error & {
  statusCode?: number
}

const getErrorStatusCode = (error: unknown): number | undefined => {
  const msError = error as MailerSendLikeError
  return msError?.statusCode
}

export const isNonRetriableError = (error: unknown): boolean => {
  const statusCode = getErrorStatusCode(error)
  if (statusCode !== undefined && NON_RETRIABLE_CODES.has(statusCode)) {
    return true
  }
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase()
  return NON_RETRIABLE_STRINGS.some((s) => message.includes(s))
}

const PROVIDER_PATTERNS: Array<[string[], string]> = [
  [['mailersend'], 'mailersend'],
  [['smtp', 'google'], 'google_smtp'],
]

const detectProvider = (error: unknown): string => {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase()
  return (
    PROVIDER_PATTERNS.find(([patterns]) =>
      patterns.some((p) => msg.includes(p))
    )?.[1] ?? 'unknown'
  )
}

export const runRetryChain = async (
  msg: EmailMessage,
  context: RetryContext
): Promise<void> => {
  try {
    await sendEmail(msg)
    logBusinessEvent({
      event: 'email_retry_success',
      details: {
        emailType: context.emailType,
        referenceId: context.referenceId,
        attempt: 1,
      },
      success: true,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const history: EmailAttemptRecord[] = [
      {
        attempt: 1,
        timestamp: new Date().toISOString(),
        error: errorMsg,
        provider: detectProvider(error),
      },
    ]

    logError({
      error,
      context: 'email_retry_attempt',
      additionalInfo: {
        emailType: context.emailType,
        referenceId: context.referenceId,
        attempt: 1,
        provider: detectProvider(error),
      },
    })

    const nonRetriable = isNonRetriableError(error)
    if (nonRetriable) {
      logBusinessEvent({
        event: 'email_retry_non_retriable',
        details: {
          emailType: context.emailType,
          referenceId: context.referenceId,
          attempt: 1,
          error: errorMsg,
        },
        success: false,
      })
    }

    await saveFailedEmail({
      recipientEmail: msg.to,
      subject: msg.subject,
      bodyHtml: msg.html,
      bodyText: msg.text,
      emailType: context.emailType,
      referenceId: context.referenceId ?? '',
      errorHistory: history,
      isRetriable: !nonRetriable,
      attemptCount: 1,
      lastError: errorMsg,
    })

    logBusinessEvent({
      event: 'email_retry_exhausted',
      details: {
        emailType: context.emailType,
        referenceId: context.referenceId,
        totalAttempts: 1,
        isRetriable: !nonRetriable,
      },
      success: false,
    })
  }
}

export const sendWithRetry = (
  msg: EmailMessage,
  context: RetryContext
): void => {
  try {
    waitUntil(runRetryChain(msg, context))
  } catch {
    runRetryChain(msg, context).catch(() => undefined)
  }
}
