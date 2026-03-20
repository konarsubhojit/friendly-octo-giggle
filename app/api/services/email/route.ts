import { type NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { getQStashReceiver } from "@/lib/qstash";
import { QStashEmailEventSchema } from "@/lib/qstash-events";
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
} from "@/lib/email";
import { isNonRetriableError } from "@/lib/email/retry";
import { saveFailedEmail } from "@/lib/email/failed-emails";
import type { EmailType } from "@/lib/email/failed-emails";
import { logBusinessEvent, logError, logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { drizzleDb } from "@/lib/db";
import { failedEmails } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

const resolveEmailType = (
  eventType: "order.created" | "order.status_changed",
): EmailType =>
  eventType === "order.created" ? "order_confirmation" : "order_status_update";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const messageId = request.headers.get("Upstash-Message-Id") ?? undefined;

  const bodyText = await request.text();

  if (
    env.QSTASH_CURRENT_SIGNING_KEY &&
    env.QSTASH_NEXT_SIGNING_KEY
  ) {
    const signature = request.headers.get("Upstash-Signature");
    if (!signature) {
      logger.warn({ messageId }, "qstash_signature_invalid");
      return apiError("Invalid signature", 401);
    }
    try {
      await getQStashReceiver().verify({ signature, body: bodyText });
    } catch {
      logger.warn({ messageId }, "qstash_signature_invalid");
      return apiError("Invalid signature", 401);
    }
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    return apiError("Invalid payload", 400);
  }

  const parseResult = QStashEmailEventSchema.safeParse(parsedBody);
  if (!parseResult.success) {
    return apiError("Invalid payload", 400);
  }

  const event = parseResult.data;
  const emailType = resolveEmailType(event.type);
  const orderId = event.data.orderId;

  const existingRecord = await drizzleDb.query.failedEmails.findFirst({
    where: and(
      eq(failedEmails.referenceId, orderId),
      eq(failedEmails.emailType, emailType),
      eq(failedEmails.status, "sent"),
    ),
  });

  if (existingRecord) {
    logger.info(
      { messageId, orderId, eventType: event.type },
      "qstash_duplicate_event_skipped",
    );
    return apiSuccess({ skipped: true });
  }

  try {
    if (event.type === "order.created") {
      await sendOrderConfirmationEmail({
        to: event.data.customerEmail,
        customerName: event.data.customerName,
        orderId: event.data.orderId,
        totalAmount: `$${(event.data.totalAmount / 100).toFixed(2)}`,
        shippingAddress: event.data.customerAddress,
        items: event.data.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: `$${(item.price / 100).toFixed(2)}`,
          variation: null,
        })),
      });
    } else {
      await sendOrderStatusUpdateEmail({
        to: event.data.customerEmail,
        customerName: event.data.customerName,
        orderId: event.data.orderId,
        status: event.data.newStatus,
        trackingNumber: event.data.trackingNumber,
        shippingProvider: event.data.shippingProvider,
      });
    }

    logger.info(
      { messageId, orderId, eventType: event.type },
      "qstash_email_sent",
    );
    logBusinessEvent({
      event: "qstash_email_sent",
      details: { messageId, orderId, eventType: event.type },
      success: true,
    });
    return apiSuccess({ sent: true });
  } catch (sendError) {
    if (isNonRetriableError(sendError)) {
      logError({
        error: sendError,
        context: "qstash_email_send_nonretriable",
        additionalInfo: { messageId, orderId, eventType: event.type },
      });
      const errorMsg =
        sendError instanceof Error ? sendError.message : String(sendError);
      await saveFailedEmail({
        recipientEmail: event.data.customerEmail,
        subject: emailType,
        bodyHtml: "",
        bodyText: "",
        emailType,
        referenceId: orderId,
        errorHistory: [
          {
            attempt: 1,
            timestamp: new Date().toISOString(),
            error: errorMsg,
            provider: "unknown",
          },
        ],
        isRetriable: false,
        attemptCount: 1,
        lastError: errorMsg,
      });
      return apiError("Permanent failure", 400);
    }

    logError({
      error: sendError,
      context: "qstash_email_send_transient",
      additionalInfo: { messageId, orderId, eventType: event.type },
    });
    return apiError("Internal error", 500);
  }
};
