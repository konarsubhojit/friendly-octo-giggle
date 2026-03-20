/**
 * Email provider initialization and transport.
 * SRP: Only handles provider setup and low-level sending.
 * OCP: New providers can be added by implementing the send flow here.
 */
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import nodemailer, { type Transporter } from "nodemailer";
import { logError, logBusinessEvent } from "@/lib/logger";

const FROM_EMAIL =
  process.env.MAILERSEND_FROM_EMAIL ??
  process.env.GOOGLE_SMTP_FROM_EMAIL ??
  process.env.GOOGLE_SMTP_USER ??
  "noreply@thekiyonstore.com";
const FROM_NAME = "The Kiyon Store";
const SMTP_HOST = process.env.GOOGLE_SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.GOOGLE_SMTP_PORT ?? "465");
const SMTP_SECURE =
  process.env.GOOGLE_SMTP_SECURE === "true" ||
  (process.env.GOOGLE_SMTP_SECURE !== "false" && SMTP_PORT === 465);

let mailerSendClient: MailerSend | null = null;
let mailerSendInitialized = false;
let smtpInitialized = false;
let smtpTransport: Transporter | null = null;

type MailerSendLikeError = Error & {
  statusCode?: number;
  body?: {
    message?: string;
    errors?: Record<string, string[]>;
  };
};

const extractMailerSendErrorMeta = (error: unknown) => {
  const msError = error as MailerSendLikeError;
  const statusCode = msError.statusCode;
  const providerErrors = msError.body?.message ? [msError.body.message] : [];
  const isUnauthorized = statusCode === 401 || statusCode === 403;

  return { statusCode, providerErrors, isUnauthorized };
};

export const initMailerSend = () => {
  if (!mailerSendInitialized && process.env.MAILERSEND_API_KEY) {
    mailerSendClient = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });
    mailerSendInitialized = true;
  }
  return mailerSendInitialized;
};

export const initGoogleSmtp = () => {
  const smtpUser = process.env.GOOGLE_SMTP_USER;
  const smtpPassword = process.env.GOOGLE_SMTP_APP_PASSWORD;

  if (!smtpInitialized && smtpUser && smtpPassword) {
    smtpTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: smtpUser, pass: smtpPassword },
    });
    smtpInitialized = true;
  }
  return smtpInitialized;
};

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const sendEmail = async (msg: EmailMessage): Promise<void> => {
  const hasGoogleSmtp = initGoogleSmtp();
  const hasMailerSend = initMailerSend();

  if (!hasGoogleSmtp && !hasMailerSend) {
    logBusinessEvent({
      event: "email_skipped",
      details: {
        to: msg.to,
        subject: msg.subject,
        reason: "no_provider_config",
      },
      success: true,
    });
    return;
  }

  if (hasGoogleSmtp && smtpTransport) {
    try {
      await smtpTransport.sendMail({
        to: msg.to,
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      logBusinessEvent({
        event: "email_sent",
        details: { to: msg.to, subject: msg.subject, provider: "google_smtp" },
        success: true,
      });
      return;
    } catch (error) {
      logError({
        error,
        context: "email_send_failed",
        additionalInfo: {
          to: msg.to,
          subject: msg.subject,
          fromEmail: FROM_EMAIL,
          provider: "google_smtp",
        },
      });
    }
  }

  if (!hasMailerSend || !mailerSendClient) return;

  try {
    const sentFrom = new Sender(FROM_EMAIL, FROM_NAME);
    const recipients = [new Recipient(msg.to)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setReplyTo(sentFrom)
      .setSubject(msg.subject)
      .setHtml(msg.html)
      .setText(msg.text);

    await mailerSendClient.email.send(emailParams);
    logBusinessEvent({
      event: "email_sent",
      details: { to: msg.to, subject: msg.subject, provider: "mailersend" },
      success: true,
    });
  } catch (error) {
    const errorMeta = extractMailerSendErrorMeta(error);

    if (errorMeta.isUnauthorized) {
      logBusinessEvent({
        event: "email_auth_failed",
        details: {
          to: msg.to,
          subject: msg.subject,
          fromEmail: FROM_EMAIL,
          statusCode: errorMeta.statusCode,
          providerErrors: errorMeta.providerErrors,
        },
        success: false,
      });
    }

    logError({
      error,
      context: "email_send_failed",
      additionalInfo: {
        to: msg.to,
        subject: msg.subject,
        fromEmail: FROM_EMAIL,
        provider: "mailersend",
        statusCode: errorMeta.statusCode,
        providerErrors: errorMeta.providerErrors,
      },
    });
  }
};
