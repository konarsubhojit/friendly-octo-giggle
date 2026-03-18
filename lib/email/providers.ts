/**
 * Email provider initialization and transport.
 * SRP: Only handles provider setup and low-level sending.
 * OCP: New providers can be added by implementing the send flow here.
 */
import sgMail from "@sendgrid/mail";
import nodemailer, { type Transporter } from "nodemailer";
import { logError, logBusinessEvent } from "@/lib/logger";

const FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL ??
  process.env.GOOGLE_SMTP_FROM_EMAIL ??
  process.env.GOOGLE_SMTP_USER ??
  "noreply@thekiyonstore.com";
const FROM_NAME = "The Kiyon Store";
const SMTP_HOST = process.env.GOOGLE_SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.GOOGLE_SMTP_PORT ?? "465");
const SMTP_SECURE =
  process.env.GOOGLE_SMTP_SECURE === "true" ||
  (process.env.GOOGLE_SMTP_SECURE !== "false" && SMTP_PORT === 465);

let sgInitialized = false;
let smtpInitialized = false;
let smtpTransport: Transporter | null = null;

type SendGridBodyError = {
  message?: string;
  field?: string;
  help?: string;
};

type SendGridLikeError = Error & {
  code?: number;
  response?: {
    statusCode?: number;
    body?: {
      errors?: SendGridBodyError[];
    };
  };
};

const extractSendGridErrorMeta = (error: unknown) => {
  const sgError = error as SendGridLikeError;
  const statusCode = sgError.response?.statusCode ?? sgError.code;
  const providerErrors =
    sgError.response?.body?.errors
      ?.map((item) => item.message)
      .filter((message): message is string => Boolean(message)) ?? [];
  const isUnauthorized = statusCode === 401 || statusCode === 403;

  return { statusCode, providerErrors, isUnauthorized };
};

export const initSendGrid = () => {
  if (!sgInitialized && process.env.SENDGRID_API_KEY) {
    if (!process.env.SENDGRID_API_KEY.startsWith("SG.")) {
      logBusinessEvent({
        event: "email_skipped",
        details: { reason: "invalid_api_key_format" },
        success: false,
      });
      return false;
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sgInitialized = true;
  }
  return sgInitialized;
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
  const hasSendGrid = initSendGrid();

  if (!hasGoogleSmtp && !hasSendGrid) {
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

  if (!hasSendGrid) return;

  try {
    await sgMail.send({
      to: msg.to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    logBusinessEvent({
      event: "email_sent",
      details: { to: msg.to, subject: msg.subject, provider: "sendgrid" },
      success: true,
    });
  } catch (error) {
    const errorMeta = extractSendGridErrorMeta(error);

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
        provider: "sendgrid",
        statusCode: errorMeta.statusCode,
        providerErrors: errorMeta.providerErrors,
      },
    });
  }
};
