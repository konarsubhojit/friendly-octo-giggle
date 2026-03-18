/**
 * Email service — public API.
 * SRP: Composes templates with providers. Only orchestration logic here.
 * DIP: Depends on abstractions (templates, sendEmail) not concrete providers.
 */
export {
  type OrderEmailItem,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
  escapeHtml,
} from "./templates";

export { sendEmail, type EmailMessage } from "./providers";

import { sendEmail } from "./providers";
import {
  orderConfirmationTemplate,
  orderStatusUpdateTemplate,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
} from "./templates";

export const sendOrderConfirmationEmail = async (
  data: OrderConfirmationData,
): Promise<void> => {
  const template = orderConfirmationTemplate(data);
  await sendEmail({ to: data.to, ...template });
};

export const sendOrderStatusUpdateEmail = async (
  data: OrderStatusUpdateData,
): Promise<void> => {
  const template = orderStatusUpdateTemplate(data);
  await sendEmail({ to: data.to, ...template });
};
