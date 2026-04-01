/**
 * Email service — backward-compatible re-export.
 *
 * The email module has been split into lib/email/ for SRP:
 * - providers.ts: Provider initialization and transport
 * - templates.ts: HTML template generation
 * - index.ts: Public API composition
 *
 * All existing imports from "@/lib/email" continue to work via this re-export.
 */
export {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendEmail,
  escapeHtml,
  type OrderEmailItem,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
  type EmailMessage,
} from "./email/index";
