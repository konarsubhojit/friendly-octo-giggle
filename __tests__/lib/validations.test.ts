import { describe, it, expect } from 'vitest'
import {
  ProductSchema,
  ProductInputSchema,
  ProductUpdateSchema,
  OrderStatusEnum,
  OrderItemSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  AddToCartSchema,
  UpdateCartItemSchema,
  EnvSchema,
  ApiErrorSchema,
  registerSchema,
  credentialsLoginSchema,
  changePasswordSchema,
  updateProfileSchema,
  CreateShareSchema,
  CreateVariantSchema,
  UpdateVariantSchema,
} from '@/lib/validations'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'
const validShortId = 'abc1234' // Base62 7-char short ID used for products, variations, carts, orders
const validISO = '2024-01-01T00:00:00.000Z'

describe('ProductSchema', () => {
  const validProduct = {
    id: validShortId,
    name: 'Test Product',
    description: 'A test product description',
    image: 'https://example.com/image.jpg',
    category: 'Electronics',
    createdAt: validISO,
    updatedAt: validISO,
  }

  it('accepts valid product', () => {
    expect(ProductSchema.parse(validProduct)).toEqual({
      ...validProduct,
      images: [],
    })
  })

  it('rejects invalid product ID', () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, id: 'not-valid-id' })
    ).toThrow()
  })

  it('rejects empty name', () => {
    expect(() => ProductSchema.parse({ ...validProduct, name: '' })).toThrow()
  })

  it('rejects invalid image URL', () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, image: 'not-a-url' })
    ).toThrow()
  })

  it('rejects invalid datetime format', () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, createdAt: '2024-01-01' })
    ).toThrow()
  })

  it('rejects name exceeding 200 chars', () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, name: 'x'.repeat(201) })
    ).toThrow()
  })
})

describe('ProductInputSchema', () => {
  it('accepts valid input without id/timestamps', () => {
    const input = {
      name: 'New Product',
      description: 'Description',
      image: 'https://example.com/img.png',
      category: 'Books',
    }
    expect(ProductInputSchema.parse(input)).toEqual({ ...input, images: [] })
  })

  it('rejects extra id field', () => {
    const input = {
      id: validUUID,
      name: 'Product',
      description: 'Desc',
      image: 'https://example.com/img.png',
      category: 'Books',
    }
    const parsed = ProductInputSchema.parse(input)
    expect(parsed).not.toHaveProperty('id')
  })
})

describe('ProductUpdateSchema', () => {
  it('accepts partial update', () => {
    expect(ProductUpdateSchema.parse({ name: 'Updated' })).toEqual({
      name: 'Updated',
      images: [],
    })
  })

  it('accepts empty object', () => {
    expect(ProductUpdateSchema.parse({})).toEqual({ images: [] })
  })
})

describe('OrderStatusEnum', () => {
  it.each(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])(
    'accepts %s',
    (status) => {
      expect(OrderStatusEnum.parse(status)).toBe(status)
    }
  )

  it('rejects invalid status', () => {
    expect(() => OrderStatusEnum.parse('UNKNOWN')).toThrow()
  })
})

describe('OrderItemSchema', () => {
  const validItem = {
    productId: validShortId,
    quantity: 2,
    price: 19.99,
  }

  it('accepts valid order item', () => {
    expect(OrderItemSchema.parse(validItem)).toEqual({
      ...validItem,
      customizationNote: undefined,
    })
  })

  it('accepts item with customization note', () => {
    const item = { ...validItem, customizationNote: 'Gift wrap please' }
    expect(OrderItemSchema.parse(item).customizationNote).toBe(
      'Gift wrap please'
    )
  })

  it('accepts null customization note', () => {
    const item = { ...validItem, customizationNote: null }
    expect(OrderItemSchema.parse(item).customizationNote).toBeNull()
  })

  it('rejects zero quantity', () => {
    expect(() => OrderItemSchema.parse({ ...validItem, quantity: 0 })).toThrow()
  })

  it('rejects negative quantity', () => {
    expect(() =>
      OrderItemSchema.parse({ ...validItem, quantity: -1 })
    ).toThrow()
  })

  it('rejects non-integer quantity', () => {
    expect(() =>
      OrderItemSchema.parse({ ...validItem, quantity: 1.5 })
    ).toThrow()
  })

  it('rejects customization note exceeding 500 chars', () => {
    expect(() =>
      OrderItemSchema.parse({
        ...validItem,
        customizationNote: 'x'.repeat(501),
      })
    ).toThrow()
  })
})

describe('CreateOrderSchema', () => {
  const validOrder = {
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    addressLine1: '123 Main Street',
    addressLine2: 'Apt 4B',
    addressLine3: '',
    pinCode: '110001',
    city: 'New Delhi',
    state: 'Delhi',
    items: [{ productId: validShortId, quantity: 1, price: 29.99 }],
  }

  it('accepts valid order', () => {
    const parsed = CreateOrderSchema.parse(validOrder)
    expect(parsed.customerName).toBe('John Doe')
  })

  it('rejects empty items array', () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, items: [] })
    ).toThrow()
  })

  it('rejects invalid email', () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, customerEmail: 'not-email' })
    ).toThrow()
  })

  it('rejects invalid pincode', () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, pinCode: '12345' })
    ).toThrow()
  })

  it('rejects empty address line 1', () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, addressLine1: '' })
    ).toThrow()
  })

  it('rejects empty name', () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, customerName: '' })
    ).toThrow()
  })
})

describe('UpdateOrderStatusSchema', () => {
  it('accepts valid status update', () => {
    const result = UpdateOrderStatusSchema.parse({ status: 'SHIPPED' })
    expect(result.status).toBe('SHIPPED')
  })

  it('accepts with optional tracking fields', () => {
    const result = UpdateOrderStatusSchema.parse({
      status: 'SHIPPED',
      trackingNumber: 'TRK123',
      shippingProvider: 'FedEx',
    })
    expect(result.trackingNumber).toBe('TRK123')
  })
})

describe('AddToCartSchema', () => {
  it('accepts valid input', () => {
    const result = AddToCartSchema.parse({
      productId: validShortId,
      variantId: validShortId,
      quantity: 1,
    })
    expect(result.productId).toBe(validShortId)
    expect(result.variantId).toBe(validShortId)
  })

  it('accepts with variantId', () => {
    const result = AddToCartSchema.parse({
      productId: validShortId,
      variantId: validShortId,
      quantity: 2,
    })
    expect(result.variantId).toBe(validShortId)
  })

  it('rejects missing variantId', () => {
    expect(() =>
      AddToCartSchema.parse({
        productId: validShortId,
        quantity: 1,
      })
    ).toThrow()
  })

  it('rejects non-integer quantity', () => {
    expect(() =>
      AddToCartSchema.parse({
        productId: validShortId,
        variantId: validShortId,
        quantity: 1.5,
      })
    ).toThrow()
  })

  it('rejects zero quantity', () => {
    expect(() =>
      AddToCartSchema.parse({
        productId: validShortId,
        variantId: validShortId,
        quantity: 0,
      })
    ).toThrow()
  })
})

describe('UpdateCartItemSchema', () => {
  it('accepts valid quantity', () => {
    expect(UpdateCartItemSchema.parse({ quantity: 3 }).quantity).toBe(3)
  })

  it('rejects zero quantity', () => {
    expect(() => UpdateCartItemSchema.parse({ quantity: 0 })).toThrow()
  })
})

describe('EnvSchema', () => {
  it('accepts valid env', () => {
    const result = EnvSchema.parse({ DATABASE_URL: 'postgres://localhost/db' })
    expect(result.DATABASE_URL).toBe('postgres://localhost/db')
  })

  it('accepts optional READ_DATABASE_URL', () => {
    const result = EnvSchema.parse({
      DATABASE_URL: 'postgres://localhost/write',
      READ_DATABASE_URL: 'postgres://localhost/read',
    })
    expect(result.READ_DATABASE_URL).toBe('postgres://localhost/read')
  })

  it('rejects missing DATABASE_URL', () => {
    expect(() => EnvSchema.parse({})).toThrow()
  })

  it('accepts optional NODE_ENV', () => {
    const result = EnvSchema.parse({
      DATABASE_URL: 'postgres://localhost/db',
      NODE_ENV: 'test',
    })
    expect(result.NODE_ENV).toBe('test')
  })

  it('rejects invalid NODE_ENV', () => {
    expect(() =>
      EnvSchema.parse({
        DATABASE_URL: 'postgres://localhost/db',
        NODE_ENV: 'staging',
      })
    ).toThrow()
  })
})

describe('ApiErrorSchema', () => {
  it('accepts valid error response', () => {
    const result = ApiErrorSchema.parse({
      error: 'Something failed',
      success: false,
    })
    expect(result.error).toBe('Something failed')
  })

  it('accepts with details', () => {
    const result = ApiErrorSchema.parse({
      error: 'Validation failed',
      success: false,
      details: { name: 'Required' },
    })
    expect(result.details).toEqual({ name: 'Required' })
  })

  it('rejects success: true', () => {
    expect(() =>
      ApiErrorSchema.parse({ error: 'fail', success: true })
    ).toThrow()
  })
})

describe('registerSchema', () => {
  const validRegistration = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'StrongPass1!',
    confirmPassword: 'StrongPass1!',
  }

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse(validRegistration)
    expect(result.success).toBe(true)
  })

  it('accepts registration with phone number', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      phoneNumber: '+1234567890',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = registerSchema.safeParse({ ...validRegistration, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects weak password', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'weak',
      confirmPassword: 'weak',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: 'Different1!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid phone number format', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      phoneNumber: 'abc',
    })
    expect(result.success).toBe(false)
  })
})

describe('credentialsLoginSchema', () => {
  it('accepts valid login data', () => {
    const result = credentialsLoginSchema.safeParse({
      identifier: 'test@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty identifier', () => {
    const result = credentialsLoginSchema.safeParse({
      identifier: '',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = credentialsLoginSchema.safeParse({
      identifier: 'test@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  const validChangePassword = {
    currentPassword: 'OldPass1!',
    newPassword: 'NewStrong1!',
    confirmNewPassword: 'NewStrong1!',
  }

  it('accepts valid change password data', () => {
    const result = changePasswordSchema.safeParse(validChangePassword)
    expect(result.success).toBe(true)
  })

  it('rejects weak new password', () => {
    const result = changePasswordSchema.safeParse({
      ...validChangePassword,
      newPassword: 'weak',
      confirmNewPassword: 'weak',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched new passwords', () => {
    const result = changePasswordSchema.safeParse({
      ...validChangePassword,
      confirmNewPassword: 'Different1!',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('accepts valid profile update with name only', () => {
    const result = updateProfileSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('accepts valid profile update with email', () => {
    const result = updateProfileSchema.safeParse({ email: 'new@example.com' })
    expect(result.success).toBe(true)
  })

  it('accepts valid profile update with phone', () => {
    const result = updateProfileSchema.safeParse({
      phoneNumber: '+1234567890',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = updateProfileSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = updateProfileSchema.safeParse({ email: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid phone number', () => {
    const result = updateProfileSchema.safeParse({ phoneNumber: 'abc' })
    expect(result.success).toBe(false)
  })
})

describe('CreateShareSchema', () => {
  it('accepts valid productId without variantId', () => {
    const result = CreateShareSchema.safeParse({ productId: validShortId })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.productId).toBe(validShortId)
  })

  it('accepts valid productId with valid variantId', () => {
    const result = CreateShareSchema.safeParse({
      productId: validShortId,
      variantId: 'xyz1234',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.variantId).toBe('xyz1234')
  })

  it('accepts null variantId', () => {
    const result = CreateShareSchema.safeParse({
      productId: validShortId,
      variantId: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts missing variantId (nullish)', () => {
    const result = CreateShareSchema.safeParse({ productId: validShortId })
    expect(result.success).toBe(true)
  })

  it('rejects missing productId', () => {
    const result = CreateShareSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid productId (wrong format)', () => {
    const result = CreateShareSchema.safeParse({ productId: 'bad!' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid variantId (too long)', () => {
    const result = CreateShareSchema.safeParse({
      productId: validShortId,
      variantId: 'toolongid',
    })
    expect(result.success).toBe(false)
  })
})

// ─── CreateVariantSchema ───────────────────────────────

describe('CreateVariantSchema', () => {
  const validVariant = {
    price: 150.0,
    stock: 100,
  }

  it('accepts valid variant with required fields only', () => {
    const result = CreateVariantSchema.safeParse(validVariant)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toEqual([])
    }
  })

  it('accepts valid variant with optional image fields', () => {
    const result = CreateVariantSchema.safeParse({
      ...validVariant,
      image: 'https://example.com/img.jpg',
      images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts variant with sku', () => {
    const result = CreateVariantSchema.safeParse({
      ...validVariant,
      sku: 'SKU-001',
    })
    expect(result.success).toBe(true)
  })

  it('accepts zero stock', () => {
    const result = CreateVariantSchema.safeParse({
      ...validVariant,
      stock: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing stock', () => {
    const { stock: _stock, ...rest } = validVariant
    const result = CreateVariantSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects negative stock', () => {
    const result = CreateVariantSchema.safeParse({
      ...validVariant,
      stock: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer stock', () => {
    const result = CreateVariantSchema.safeParse({
      ...validVariant,
      stock: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing price', () => {
    const { price: _price, ...rest } = validVariant
    const result = CreateVariantSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid image URL', () => {
    const result = CreateVariantSchema.safeParse({
      ...validVariant,
      image: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 additional images', () => {
    const result = CreateVariantSchema.safeParse({
      ...validVariant,
      images: Array(11).fill('https://example.com/img.jpg'),
    })
    expect(result.success).toBe(false)
  })
})

// ─── UpdateVariantSchema ───────────────────────────────

describe('UpdateVariantSchema', () => {
  it('accepts partial update with just stock', () => {
    const result = UpdateVariantSchema.safeParse({ stock: 50 })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = UpdateVariantSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid stock in partial update', () => {
    const result = UpdateVariantSchema.safeParse({ stock: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid image URL in partial update', () => {
    const result = UpdateVariantSchema.safeParse({ image: 'bad' })
    expect(result.success).toBe(false)
  })
})
