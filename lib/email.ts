/**
 * Email service using SendGrid.
 * Falls back gracefully when SENDGRID_API_KEY is not configured.
 */
import sgMail from "@sendgrid/mail";
import { logError, logBusinessEvent } from "@/lib/logger";

const FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL ?? "noreply@thekiyonstore.com";
const FROM_NAME = "The Kiyon Store";

let sgInitialized = false;

const initSendGrid = () => {
  if (!sgInitialized && process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sgInitialized = true;
  }
  return sgInitialized;
};

// ─── Email Data Types ─────────────────────────────────────

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: string;
  variation?: string | null;
}

export interface OrderConfirmationData {
  to: string;
  customerName: string;
  orderId: string;
  totalAmount: string;
  items: OrderEmailItem[];
  shippingAddress: string;
}

export interface OrderStatusUpdateData {
  to: string;
  customerName: string;
  orderId: string;
  status: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
}

// ─── HTML Helpers ─────────────────────────────────────────

/** Escapes user-controlled text for safe interpolation into HTML email bodies. */
export const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Kiyon Store</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF5EE;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" style="max-width:600px;background:#FFFDFB;border-radius:16px;box-shadow:0 4px 20px rgba(92,74,68,0.08);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#b83060,#cc4880);padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-style:italic;letter-spacing:1px;">🌸 The Kiyon Store</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Handmade with love</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px;text-align:center;border-top:1px solid #F2E8E4;">
          <p style="margin:0;color:#7a5543;font-size:13px;">© ${new Date().getFullYear()} The Kiyon Store. All rights reserved.</p>
          <p style="margin:8px 0 0;color:#7a5543;font-size:12px;">Handcrafted with ❤️</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const itemsTableHtml = (items: OrderEmailItem[]) => `
<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0;">
  <thead>
    <tr style="background:#F9F0EB;">
      <th style="text-align:left;padding:10px 12px;color:#5C4A44;font-size:13px;font-weight:600;border-bottom:2px solid #E8D5CC;">Item</th>
      <th style="text-align:center;padding:10px 12px;color:#5C4A44;font-size:13px;font-weight:600;border-bottom:2px solid #E8D5CC;">Qty</th>
      <th style="text-align:right;padding:10px 12px;color:#5C4A44;font-size:13px;font-weight:600;border-bottom:2px solid #E8D5CC;">Price</th>
    </tr>
  </thead>
  <tbody>
    ${items
      .map(
        (item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #F2E8E4;color:#5C4A44;font-size:13px;">
        ${escapeHtml(item.name)}${item.variation ? `<br><span style="color:#7a5543;font-size:12px;">${escapeHtml(item.variation)}</span>` : ""}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #F2E8E4;text-align:center;color:#5C4A44;font-size:13px;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F2E8E4;text-align:right;color:#b83060;font-size:13px;font-weight:600;">${escapeHtml(item.price)}</td>
    </tr>`,
      )
      .join("")}
  </tbody>
</table>`;

const statusLabel: Record<string, { label: string; emoji: string; color: string }> = {
  PENDING: { label: "Pending", emoji: "⏳", color: "#d97706" },
  PROCESSING: { label: "Processing", emoji: "⚙️", color: "#2563eb" },
  SHIPPED: { label: "Shipped", emoji: "📦", color: "#7c3aed" },
  DELIVERED: { label: "Delivered", emoji: "✅", color: "#059669" },
  CANCELLED: { label: "Cancelled", emoji: "❌", color: "#dc2626" },
};

// ─── Send Helpers ─────────────────────────────────────────

const sendEmail = async (msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> => {
  if (!initSendGrid()) {
    logBusinessEvent({
      event: "email_skipped",
      details: { to: msg.to, subject: msg.subject, reason: "no_api_key" },
      success: true,
    });
    return;
  }
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
      details: { to: msg.to, subject: msg.subject },
      success: true,
    });
  } catch (error) {
    logError({ error, context: "email_send_failed", additionalInfo: { subject: msg.subject } });
    // Email failures are non-fatal — we log but do not throw
  }
};

// ─── Public Email Functions ───────────────────────────────

export const sendOrderConfirmationEmail = async (
  data: OrderConfirmationData,
): Promise<void> => {
  const bodyHtml = `
    <h2 style="color:#5C4A44;margin:0 0 8px;font-size:22px;">Thank you, ${escapeHtml(data.customerName)}! 🌸</h2>
    <p style="color:#7a5543;margin:0 0 24px;font-size:15px;">
      We've received your order and will start preparing it with care.
    </p>
    <div style="background:#F9F0EB;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#5C4A44;font-size:14px;">
        <strong>Order ID:</strong> <span style="font-family:monospace;color:#b83060;">#${escapeHtml(data.orderId.toUpperCase())}</span>
      </p>
    </div>
    <h3 style="color:#5C4A44;font-size:15px;margin:0 0 8px;">Order Summary</h3>
    ${itemsTableHtml(data.items)}
    <div style="text-align:right;padding:8px 12px;background:#F9F0EB;border-radius:8px;margin-bottom:24px;">
      <strong style="color:#5C4A44;font-size:15px;">Total: </strong>
      <span style="color:#b83060;font-size:18px;font-weight:700;">${escapeHtml(data.totalAmount)}</span>
    </div>
    <div style="margin-bottom:24px;">
      <h3 style="color:#5C4A44;font-size:15px;margin:0 0 8px;">Shipping Address</h3>
      <p style="color:#7a5543;font-size:14px;margin:0;white-space:pre-line;">${escapeHtml(data.shippingAddress)}</p>
    </div>
    <p style="color:#7a5543;font-size:14px;margin:0;">
      You'll receive another email once your order has been shipped. ✨
    </p>`;

  await sendEmail({
    to: data.to,
    subject: `Order Confirmed — #${data.orderId.toUpperCase()} 🌸`,
    html: emailWrapper(bodyHtml),
    text: `Hi ${data.customerName},\n\nYour order #${data.orderId.toUpperCase()} has been confirmed!\nTotal: ${data.totalAmount}\n\nShipping to:\n${data.shippingAddress}\n\nThank you for shopping with The Kiyon Store!`,
  });
};

export const sendOrderStatusUpdateEmail = async (
  data: OrderStatusUpdateData,
): Promise<void> => {
  const info = statusLabel[data.status] ?? {
    label: data.status,
    emoji: "📋",
    color: "#5C4A44",
  };

  const trackingSection =
    data.status === "SHIPPED" && (data.trackingNumber || data.shippingProvider)
      ? `<div style="background:#F0F7FF;border-radius:12px;padding:16px 20px;margin-top:20px;">
          <h3 style="margin:0 0 8px;color:#5C4A44;font-size:15px;">Tracking Information</h3>
          ${data.shippingProvider ? `<p style="margin:0 0 4px;color:#7a5543;font-size:14px;"><strong>Carrier:</strong> ${escapeHtml(data.shippingProvider)}</p>` : ""}
          ${data.trackingNumber ? `<p style="margin:0;color:#7a5543;font-size:14px;"><strong>Tracking #:</strong> <span style="font-family:monospace;color:#2563eb;">${escapeHtml(data.trackingNumber)}</span></p>` : ""}
        </div>`
      : "";

  const bodyHtml = `
    <h2 style="color:#5C4A44;margin:0 0 8px;font-size:22px;">
      ${info.emoji} Your Order Status Update
    </h2>
    <p style="color:#7a5543;margin:0 0 24px;font-size:15px;">
      Hi ${escapeHtml(data.customerName)}, here's an update on your order.
    </p>
    <div style="background:#F9F0EB;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;color:#5C4A44;font-size:14px;">
        <strong>Order:</strong> <span style="font-family:monospace;color:#b83060;">#${escapeHtml(data.orderId.toUpperCase())}</span>
      </p>
      <p style="margin:0;color:#5C4A44;font-size:14px;">
        <strong>New Status:</strong>
        <span style="background-color:${info.color}1a;color:${info.color};padding:2px 8px;border-radius:20px;font-size:13px;font-weight:600;margin-left:6px;">
          ${info.label}
        </span>
      </p>
    </div>
    ${trackingSection}
    <p style="color:#7a5543;font-size:14px;margin-top:24px;">
      Thank you for your patience. We appreciate your business! 🌸
    </p>`;

  await sendEmail({
    to: data.to,
    subject: `Your Order #${data.orderId.toUpperCase()} is now ${info.label} ${info.emoji}`,
    html: emailWrapper(bodyHtml),
    text: `Hi ${data.customerName},\n\nYour order #${data.orderId.toUpperCase()} status has been updated to: ${info.label}\n${data.trackingNumber ? `\nTracking: ${data.trackingNumber}` : ""}${data.shippingProvider ? `\nCarrier: ${data.shippingProvider}` : ""}\n\nThank you for shopping with The Kiyon Store!`,
  });
};
