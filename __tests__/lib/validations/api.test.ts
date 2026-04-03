import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ApiSuccessSchema, ApiErrorSchema } from '@/lib/validations/api'

describe('ApiSuccessSchema', () => {
  it('validates a success response with string data', () => {
    const schema = ApiSuccessSchema(z.string())
    const result = schema.safeParse({ data: 'hello', success: true })

    expect(result.success).toBe(true)
  })

  it('validates a success response with object data', () => {
    const schema = ApiSuccessSchema(z.object({ id: z.number() }))
    const result = schema.safeParse({ data: { id: 1 }, success: true })

    expect(result.success).toBe(true)
  })

  it('rejects when success is false', () => {
    const schema = ApiSuccessSchema(z.string())
    const result = schema.safeParse({ data: 'hello', success: false })

    expect(result.success).toBe(false)
  })

  it('rejects when data does not match schema', () => {
    const schema = ApiSuccessSchema(z.number())
    const result = schema.safeParse({ data: 'not-a-number', success: true })

    expect(result.success).toBe(false)
  })

  it('rejects when data is missing', () => {
    const schema = ApiSuccessSchema(z.string())
    const result = schema.safeParse({ success: true })

    expect(result.success).toBe(false)
  })
})

describe('ApiErrorSchema', () => {
  it('validates an error response', () => {
    const result = ApiErrorSchema.safeParse({
      error: 'Something went wrong',
      success: false,
    })

    expect(result.success).toBe(true)
  })

  it('validates an error response with details', () => {
    const result = ApiErrorSchema.safeParse({
      error: 'Validation failed',
      success: false,
      details: { name: 'Required', email: 'Invalid' },
    })

    expect(result.success).toBe(true)
  })

  it('rejects when success is true', () => {
    const result = ApiErrorSchema.safeParse({
      error: 'Error message',
      success: true,
    })

    expect(result.success).toBe(false)
  })

  it('rejects when error message is missing', () => {
    const result = ApiErrorSchema.safeParse({ success: false })

    expect(result.success).toBe(false)
  })

  it('allows missing details', () => {
    const result = ApiErrorSchema.safeParse({
      error: 'Error',
      success: false,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.details).toBeUndefined()
    }
  })
})
