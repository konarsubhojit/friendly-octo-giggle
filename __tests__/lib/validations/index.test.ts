import { describe, it, expect } from 'vitest'
import {
  PASSWORD_REQUIREMENTS,
  SHORT_ID_REGEX,
  ORDER_ID_REGEX,
  URL_REGEX,
  ISO_DATETIME_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  PASSWORD_REGEX,
  ApiSuccessSchema,
  ApiErrorSchema,
  EnvSchema,
  ProductSchema,
  ProductInputSchema,
  ProductUpdateSchema,
  CreateVariantSchema,
  UpdateVariantSchema,
  CreateReviewSchema,
  CreateShareSchema,
  registerSchema,
  credentialsLoginSchema,
  changePasswordSchema,
  updateProfileSchema,
  AddToCartSchema,
  UpdateCartItemSchema,
  CheckoutOrderItemSchema,
  SubmitCheckoutSchema,
  CheckoutQueueMessageSchema,
  OrderStatusEnum,
  CheckoutRequestStatusEnum,
  OrderItemSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  FailedEmailQuerySchema,
  ManualRetryBodySchema,
} from '@/lib/validations/index'

describe('lib/validations/index re-exports', () => {
  it('re-exports primitives', () => {
    expect(PASSWORD_REQUIREMENTS).toBeDefined()
    expect(SHORT_ID_REGEX).toBeInstanceOf(RegExp)
    expect(ORDER_ID_REGEX).toBeInstanceOf(RegExp)
    expect(URL_REGEX).toBeInstanceOf(RegExp)
    expect(ISO_DATETIME_REGEX).toBeInstanceOf(RegExp)
    expect(EMAIL_REGEX).toBeInstanceOf(RegExp)
    expect(PHONE_REGEX).toBeInstanceOf(RegExp)
    expect(PASSWORD_REGEX).toBeInstanceOf(RegExp)
  })

  it('re-exports API schemas', () => {
    expect(ApiSuccessSchema).toBeDefined()
    expect(ApiErrorSchema).toBeDefined()
  })

  it('re-exports env schema', () => {
    expect(EnvSchema).toBeDefined()
  })

  it('re-exports product schemas', () => {
    expect(ProductSchema).toBeDefined()
    expect(ProductInputSchema).toBeDefined()
    expect(ProductUpdateSchema).toBeDefined()
    expect(CreateVariantSchema).toBeDefined()
    expect(UpdateVariantSchema).toBeDefined()
    expect(CreateReviewSchema).toBeDefined()
    expect(CreateShareSchema).toBeDefined()
  })

  it('re-exports auth schemas', () => {
    expect(registerSchema).toBeDefined()
    expect(credentialsLoginSchema).toBeDefined()
    expect(changePasswordSchema).toBeDefined()
    expect(updateProfileSchema).toBeDefined()
  })

  it('re-exports cart schemas', () => {
    expect(AddToCartSchema).toBeDefined()
    expect(UpdateCartItemSchema).toBeDefined()
    expect(CheckoutOrderItemSchema).toBeDefined()
    expect(SubmitCheckoutSchema).toBeDefined()
    expect(CheckoutQueueMessageSchema).toBeDefined()
  })

  it('re-exports order schemas', () => {
    expect(OrderStatusEnum).toBeDefined()
    expect(CheckoutRequestStatusEnum).toBeDefined()
    expect(OrderItemSchema).toBeDefined()
    expect(CreateOrderSchema).toBeDefined()
    expect(UpdateOrderStatusSchema).toBeDefined()
  })

  it('re-exports admin schemas', () => {
    expect(FailedEmailQuerySchema).toBeDefined()
    expect(ManualRetryBodySchema).toBeDefined()
  })
})
