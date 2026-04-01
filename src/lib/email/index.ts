export {
  type OrderEmailItem,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
  escapeHtml,
} from "./templates";

export { sendEmail, type EmailMessage } from "./providers";

export { sendWithRetry } from "./retry";

import { sendWithRetry } from "./retry";
import {
  orderConfirmationTemplate,
  orderStatusUpdateTemplate,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
} from "./templates";

export const sendOrderConfirmationEmail = (
  data: OrderConfirmationData,
): void => {
  const template = orderConfirmationTemplate(data);
  sendWithRetry(
    { to: data.to, ...template },
    { emailType: "order_confirmation", referenceId: data.orderId },
  );
};

export const sendOrderStatusUpdateEmail = (
  data: OrderStatusUpdateData,
): void => {
  const template = orderStatusUpdateTemplate(data);
  sendWithRetry(
    { to: data.to, ...template },
    { emailType: "order_status_update", referenceId: data.orderId },
  );
};
