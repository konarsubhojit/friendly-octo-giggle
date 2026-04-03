// Backward-compat re-exports — import from feature or lib/validations/* paths
// directly in new code.
export {
  PASSWORD_REQUIREMENTS,
  SHORT_ID_REGEX,
  ORDER_ID_REGEX,
  URL_REGEX,
  ISO_DATETIME_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  PASSWORD_REGEX,
} from "./primitives";

export { ApiSuccessSchema, ApiErrorSchema } from "./api";
export type { AsyncResult, PaginatedResponse } from "./api";

export { EnvSchema } from "./env";
export type { Env } from "./env";

export {
  ProductSchema,
  ProductInputSchema,
  ProductUpdateSchema,
  CreateVariationSchema,
  UpdateVariationSchema,
  CreateReviewSchema,
  CreateShareSchema,
} from "@/features/product/validations";
export type {
  ProductInput,
  ProductUpdate,
  CreateVariationInput,
  UpdateVariationInput,
  CreateReviewInput,
  CreateShareInput,
} from "@/features/product/validations";

export {
  registerSchema,
  credentialsLoginSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "@/features/auth/validations";
export type {
  RegisterInput,
  CredentialsLoginInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from "@/features/auth/validations";

export {
  AddToCartSchema,
  UpdateCartItemSchema,
  CheckoutOrderItemSchema,
  SubmitCheckoutSchema,
  CheckoutQueueMessageSchema,
} from "@/features/cart/validations";
export type {
  AddToCartInput,
  UpdateCartItemInput,
  SubmitCheckoutInput,
} from "@/features/cart/validations";

export {
  OrderStatusEnum,
  CheckoutRequestStatusEnum,
  OrderItemSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
} from "@/features/orders/validations";
export type {
  OrderStatusType,
  CreateOrderInput,
} from "@/features/orders/validations";

export {
  FailedEmailQuerySchema,
  ManualRetryBodySchema,
} from "@/features/admin/validations";
export type {
  FailedEmailQuery,
  ManualRetryBody,
} from "@/features/admin/validations";
