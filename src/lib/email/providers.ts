/**
 * Email provider initialization and transport.
 * SRP: Only handles provider setup and low-level sending.
 * OCP: New providers can be added by implementing the send flow here.
 */
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend'
import nodemailer, { type Transporter } from 'nodemailer'
import { logError, logBusinessEvent } from '@/lib/logger'
import { STORE_NAME } from '@/lib/constants/store'

const FROM_EMAIL =
  process.env.MAILERSEND_FROM_EMAIL ??
  process.env.GOOGLE_SMTP_FROM_EMAIL ??
  process.env.GOOGLE_SMTP_USER ??
  'noreply@thekiyonstore.com'
const FROM_NAME = STORE_NAME
const SMTP_HOST = process.env.GOOGLE_SMTP_HOST ?? 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.GOOGLE_SMTP_PORT ?? '465')
const SMTP_SECURE =
  process.env.GOOGLE_SMTP_SECURE === 'true' ||
  (process.env.GOOGLE_SMTP_SECURE !== 'false' && SMTP_PORT === 465)

let mailerSendClient: MailerSend | null = null
let mailerSendInitialized = false
let smtpInitialized = false
let smtpTransport: Transporter | null = null

type MailerSendLikeError = Error & {
  statusCode?: number
  body?: {
    message?: string
    errors?: Record<string, string[]>
  }
}

const extractMailerSendErrorMeta = (error: unknown) => {
  const msError = error as MailerSendLikeError
  const statusCode = msError.statusCode
  const providerErrors = msError.body?.message ? [msError.body.message] : []
  const isUnauthorized = statusCode === 401 || statusCode === 403

  return { statusCode, providerErrors, isUnauthorized }
}

export const initMailerSend = () => {
  if (!mailerSendInitialized && process.env.MAILERSEND_API_KEY) {
    mailerSendClient = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    })
    mailerSendInitialized = true
  }
  return mailerSendInitialized
}

export const initGoogleSmtp = () => {
  const smtpUser = process.env.GOOGLE_SMTP_USER
  const smtpPassword = process.env.GOOGLE_SMTP_APP_PASSWORD

  if (!smtpInitialized && smtpUser && smtpPassword) {
    smtpTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: smtpUser, pass: smtpPassword },
    })
    smtpInitialized = true
  }
  return smtpInitialized
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export type EmailProviderName = 'google_smtp' | 'mailersend'

/**
 * Outcome of a delivery attempt.
 *
 * `delivered: false` means no provider was configured at all — a deliberate
 * no-op in environments without mail credentials, not a failure. A genuine
 * failure throws `EmailDeliveryError` instead, so a durable caller can tell
 * "nothing to do" apart from "this needs retrying".
 */
export interface EmailDeliveryResult {
  readonly delivered: boolean
  readonly provider: EmailProviderName | null
  /** True when the primary provider failed and a secondary one delivered. */
  readonly usedFallbackProvider: boolean
}

/** Raised when every configured provider refused the message. */
export class EmailDeliveryError extends Error {
  readonly providersAttempted: readonly EmailProviderName[]

  constructor(
    message: string,
    providersAttempted: readonly EmailProviderName[],
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'EmailDeliveryError'
    this.providersAttempted = providersAttempted
  }
}

const deliverViaSmtp = async (msg: EmailMessage): Promise<void> => {
  if (!smtpTransport) throw new Error('SMTP transport is not initialised')

  await smtpTransport.sendMail({
    to: msg.to,
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  })
  logBusinessEvent({
    event: 'email_sent',
    details: { to: msg.to, subject: msg.subject, provider: 'google_smtp' },
    success: true,
  })
}

const deliverViaMailerSend = async (msg: EmailMessage): Promise<void> => {
  if (!mailerSendClient) throw new Error('MailerSend client is not initialised')

  const sentFrom = new Sender(FROM_EMAIL, FROM_NAME)
  const recipients = [new Recipient(msg.to)]

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setReplyTo(sentFrom)
    .setSubject(msg.subject)
    .setHtml(msg.html)
    .setText(msg.text)

  await mailerSendClient.email.send(emailParams)
  logBusinessEvent({
    event: 'email_sent',
    details: { to: msg.to, subject: msg.subject, provider: 'mailersend' },
    success: true,
  })
}

const logMailerSendFailure = (msg: EmailMessage, error: unknown): void => {
  const errorMeta = extractMailerSendErrorMeta(error)

  if (errorMeta.isUnauthorized) {
    logBusinessEvent({
      event: 'email_auth_failed',
      details: {
        to: msg.to,
        subject: msg.subject,
        fromEmail: FROM_EMAIL,
        statusCode: errorMeta.statusCode,
        providerErrors: errorMeta.providerErrors,
      },
      success: false,
    })
  }

  logError({
    error,
    context: 'email_send_failed',
    additionalInfo: {
      to: msg.to,
      subject: msg.subject,
      fromEmail: FROM_EMAIL,
      provider: 'mailersend',
      statusCode: errorMeta.statusCode,
      providerErrors: errorMeta.providerErrors,
    },
  })
}

/**
 * Send a message, reporting which provider delivered it and throwing when
 * none could.
 *
 * This is the entry point durable callers use: an Inngest step can only retry
 * a delivery it is told about, so a total failure has to surface as a thrown
 * error rather than a log line. `sendEmail` keeps the older swallow-and-log
 * contract for fire-and-forget callers.
 */
export const deliverEmail = async (
  msg: EmailMessage
): Promise<EmailDeliveryResult> => {
  const hasGoogleSmtp = initGoogleSmtp()
  const hasMailerSend = initMailerSend()

  if (!hasGoogleSmtp && !hasMailerSend) {
    logBusinessEvent({
      event: 'email_skipped',
      details: {
        to: msg.to,
        subject: msg.subject,
        reason: 'no_provider_config',
      },
      success: true,
    })
    return { delivered: false, provider: null, usedFallbackProvider: false }
  }

  const attempted: EmailProviderName[] = []
  let primaryFailure: unknown

  if (hasGoogleSmtp && smtpTransport) {
    attempted.push('google_smtp')
    try {
      await deliverViaSmtp(msg)
      return {
        delivered: true,
        provider: 'google_smtp',
        usedFallbackProvider: false,
      }
    } catch (error) {
      primaryFailure = error
      logError({
        error,
        context: 'email_send_failed',
        additionalInfo: {
          to: msg.to,
          subject: msg.subject,
          fromEmail: FROM_EMAIL,
          provider: 'google_smtp',
        },
      })
    }
  }

  if (hasMailerSend && mailerSendClient) {
    attempted.push('mailersend')
    try {
      await deliverViaMailerSend(msg)
      return {
        delivered: true,
        provider: 'mailersend',
        // Only a fallback if a primary provider was tried and failed first.
        usedFallbackProvider: primaryFailure !== undefined,
      }
    } catch (error) {
      logMailerSendFailure(msg, error)
      throw new EmailDeliveryError(
        `Email delivery failed for every configured provider (${attempted.join(', ')})`,
        attempted,
        { cause: error }
      )
    }
  }

  throw new EmailDeliveryError(
    `Email delivery failed for every configured provider (${attempted.join(', ')})`,
    attempted,
    { cause: primaryFailure }
  )
}

/**
 * Fire-and-forget send.
 *
 * Never throws: callers on this path have no way to react to a failure, and
 * `deliverEmail` has already logged the provider errors by the time it
 * rejects.
 */
export const sendEmail = async (msg: EmailMessage): Promise<void> => {
  try {
    await deliverEmail(msg)
  } catch {
    // Already logged inside deliverEmail.
  }
}
