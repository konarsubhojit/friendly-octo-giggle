/**
 * Email HTML templates.
 * SRP: Only handles HTML generation — no sending or provider logic.
 * OCP: New email types are added by creating new template functions.
 */

// ─── Data Types ─────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────

export const escapeHtml = (str: string): string =>
  str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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

const statusLabel: Record<
  string,
  { label: string; emoji: string; color: string }
> = {
  PENDING: { label: "Pending", emoji: "⏳", color: "#d97706" },
  PROCESSING: { label: "Processing", emoji: "⚙️", color: "#2563eb" },
  SHIPPED: { label: "Shipped", emoji: "📦", color: "#7c3aed" },
  DELIVERED: { label: "Delivered", emoji: "✅", color: "#059669" },
  CANCELLED: { label: "Cancelled", emoji: "❌", color: "#dc2626" },
};

export const orderConfirmationTemplate = (data: OrderConfirmationData) => {
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

  const itemLines = data.items
    .map((item) => {
      const variationStr = item.variation ? ` (${item.variation})` : "";
      return `- ${item.name} x${item.quantity}: ${item.price}${variationStr}`;
    })
    .join("\n");

  return {
    subject: `Order Confirmed — #${data.orderId.toUpperCase()} 🌸`,
    html: emailWrapper(bodyHtml),
    text: `Hi ${data.customerName},\n\nYour order #${data.orderId.toUpperCase()} has been confirmed!\nTotal: ${data.totalAmount}\n\nItems:\n${itemLines}\n\nShipping to:\n${data.shippingAddress}\n\nThank you for shopping with The Kiyon Store!`,
  };
};

export const orderStatusUpdateTemplate = (data: OrderStatusUpdateData) => {
  const info = statusLabel[data.status] ?? {
    label: data.status,
    emoji: "📋",
    color: "#5C4A44",
  };

  const carrierHtml = data.shippingProvider
    ? `<p style="margin:0 0 4px;color:#7a5543;font-size:14px;"><strong>Carrier:</strong> ${escapeHtml(data.shippingProvider)}</p>`
    : "";
  const trackingHtml = data.trackingNumber
    ? `<p style="margin:0;color:#7a5543;font-size:14px;"><strong>Tracking #:</strong> <span style="font-family:monospace;color:#2563eb;">${escapeHtml(data.trackingNumber)}</span></p>`
    : "";

  const trackingSection =
    data.status === "SHIPPED" && (data.trackingNumber || data.shippingProvider)
      ? `<div style="background:#F0F7FF;border-radius:12px;padding:16px 20px;margin-top:20px;">
          <h3 style="margin:0 0 8px;color:#5C4A44;font-size:15px;">Tracking Information</h3>
          ${carrierHtml}
          ${trackingHtml}
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
          ${escapeHtml(info.label)}
        </span>
      </p>
    </div>
    ${trackingSection}
    <p style="color:#7a5543;font-size:14px;margin-top:24px;">
      Thank you for your patience. We appreciate your business! 🌸
    </p>`;

  const trackingLine = data.trackingNumber ? `\nTracking: ${data.trackingNumber}` : "";
  const carrierLine = data.shippingProvider ? `\nCarrier: ${data.shippingProvider}` : "";

  return {
    subject: `Your Order #${data.orderId.toUpperCase()} is now ${info.label} ${info.emoji}`,
    html: emailWrapper(bodyHtml),
    text: `Hi ${data.customerName},\n\nYour order #${data.orderId.toUpperCase()} status has been updated to: ${info.label}\n${trackingLine}${carrierLine}\n\nThank you for shopping with The Kiyon Store!`,
  };
};
