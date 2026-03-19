import { waitUntil } from "@vercel/functions";
import { logError, logBusinessEvent } from "@/lib/logger";
import { sendEmail } from "./providers";
import type { EmailMessage } from "./providers";
import { saveFailedEmail } from "./failed-emails";
import type { EmailAttemptRecord, EmailType } from "./failed-emails";

export interface RetryContext {
  readonly emailType: EmailType;
  readonly referenceId?: string;
}

const RETRY_DELAYS_MS = [10000, 30000, 60000];

const NON_RETRIABLE_CODES = new Set([401, 403]);
const NON_RETRIABLE_STRINGS = [
  "eauth",
  "eenvelope",
  "invalid address",
  "invalid email",
  "550 5.1.1",
  "unknown user",
  "no such user",
  "user unknown",
  "does not exist",
];

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type SendGridLikeError = Error & {
  code?: number;
  response?: { statusCode?: number };
};

const getErrorStatusCode = (error: unknown): number | undefined => {
  const sgError = error as SendGridLikeError;
  return sgError?.response?.statusCode ?? sgError?.code;
};

export const isNonRetriableError = (error: unknown): boolean => {
  const statusCode = getErrorStatusCode(error);
  if (statusCode !== undefined && NON_RETRIABLE_CODES.has(statusCode)) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return NON_RETRIABLE_STRINGS.some((s) => message.includes(s));
};

const PROVIDER_PATTERNS: Array<[string[], string]> = [
  [["sendgrid", "sg."], "sendgrid"],
  [["smtp", "google"], "google_smtp"],
];

const detectProvider = (error: unknown): string => {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    PROVIDER_PATTERNS.find(([patterns]) =>
      patterns.some((p) => msg.includes(p)),
    )?.[1] ?? "unknown"
  );
};

const buildAttemptRecord = (
  error: unknown,
  attemptNumber: number,
): EmailAttemptRecord => ({
  attempt: attemptNumber,
  timestamp: new Date().toISOString(),
  error: error instanceof Error ? error.message : String(error),
  provider: detectProvider(error),
});

const handleAttemptFailure = (
  error: unknown,
  context: RetryContext,
  attemptNumber: number,
  history: EmailAttemptRecord[],
): boolean => {
  const record = buildAttemptRecord(error, attemptNumber);
  history.push(record);
  logError({
    error,
    context: "email_retry_attempt",
    additionalInfo: {
      emailType: context.emailType,
      referenceId: context.referenceId,
      attempt: attemptNumber,
      provider: record.provider,
    },
  });
  if (!isNonRetriableError(error)) return false;
  logBusinessEvent({
    event: "email_retry_non_retriable",
    details: {
      emailType: context.emailType,
      referenceId: context.referenceId,
      attempt: attemptNumber,
      error: record.error,
    },
    success: false,
  });
  return true;
};

const saveEmailFailure = async (
  msg: EmailMessage,
  context: RetryContext,
  history: EmailAttemptRecord[],
  lastError: unknown,
): Promise<void> => {
  const nonRetriable = isNonRetriableError(lastError);
  const lastErrorMsg =
    lastError instanceof Error ? lastError.message : String(lastError);
  await saveFailedEmail({
    recipientEmail: msg.to,
    subject: msg.subject,
    bodyHtml: msg.html,
    bodyText: msg.text,
    emailType: context.emailType,
    referenceId: context.referenceId ?? "",
    errorHistory: history,
    isRetriable: !nonRetriable,
    attemptCount: history.length,
    lastError: lastErrorMsg,
  });
  logBusinessEvent({
    event: "email_retry_exhausted",
    details: {
      emailType: context.emailType,
      referenceId: context.referenceId,
      totalAttempts: history.length,
      isRetriable: !nonRetriable,
    },
    success: false,
  });
};

export const runRetryChain = async (
  msg: EmailMessage,
  context: RetryContext,
): Promise<void> => {
  const history: EmailAttemptRecord[] = [];
  let lastError: unknown = null;
  let succeeded = false;

  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    await delay(RETRY_DELAYS_MS[i]);
    const attemptNumber = i + 1;
    try {
      await sendEmail(msg);
      logBusinessEvent({
        event: "email_retry_success",
        details: {
          emailType: context.emailType,
          referenceId: context.referenceId,
          attempt: attemptNumber,
        },
        success: true,
      });
      succeeded = true;
      break;
    } catch (error) {
      lastError = error;
      const stop = handleAttemptFailure(error, context, attemptNumber, history);
      if (stop) break;
    }
  }

  if (!succeeded) {
    await saveEmailFailure(msg, context, history, lastError);
  }
};

export const sendWithRetry = (
  msg: EmailMessage,
  context: RetryContext,
): void => {
  try {
    waitUntil(runRetryChain(msg, context));
  } catch {
    runRetryChain(msg, context).catch(() => undefined);
  }
};
