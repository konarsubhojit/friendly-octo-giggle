import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import {
  getRetriableFailedEmails,
  retryFailedEmail,
} from "@/lib/email/failed-emails";
import type { FailedEmailRetryResult } from "@/lib/email/failed-emails";
import { logBusinessEvent, logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const isVercelCron = (request: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    return request.headers.get("authorization") === `Bearer ${cronSecret}`;
  }
  return request.headers.get("user-agent")?.startsWith("vercel-cron") ?? false;
};

export const GET = async (request: NextRequest) => {
  if (!isVercelCron(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const retriable = await getRetriableFailedEmails();

    if (retriable.length === 0) {
      logBusinessEvent({
        event: "cron_retry_emails_skip",
        details: { reason: "no_retriable_emails" },
        success: true,
      });
      return apiSuccess({ retried: 0, results: [] });
    }

    const results: FailedEmailRetryResult[] = [];
    for (const record of retriable) {
      const result = await retryFailedEmail(record.id);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logBusinessEvent({
      event: "cron_retry_emails_complete",
      details: { total: retriable.length, succeeded, failed },
      success: true,
    });

    return apiSuccess({
      retried: retriable.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    logError({ error, context: "cron_retry_emails" });
    return apiError("Cron retry failed", 500);
  }
};
