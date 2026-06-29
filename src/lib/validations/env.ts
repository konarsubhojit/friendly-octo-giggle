import { z } from 'zod'

// Keys that must be present in production (outside of the build phase).
const QSTASH_REQUIRED_KEYS = [
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const

const AUTH_REQUIRED_KEYS = ['NEXTAUTH_SECRET'] as const

type EnvData = z.infer<typeof BaseEnvSchema>

const validateProductionKeys = (data: EnvData, ctx: z.RefinementCtx) => {
  // Skip production-only checks during build phase (next build sets NODE_ENV=production)
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  if (data.NODE_ENV !== 'production' || isBuildPhase) return

  QSTASH_REQUIRED_KEYS.forEach((key) => {
    if (!data[key]) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required in production`,
      })
    }
  })

  AUTH_REQUIRED_KEYS.forEach((key) => {
    if (!data[key]?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required in production`,
      })
    }
  })
}

const parseAzureAccounts = (raw: string): unknown[] | null => {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const validateAzureBlob = (data: EnvData, ctx: z.RefinementCtx) => {
  if (data.IMAGE_UPLOAD_PROVIDER !== 'azure') return

  if (!data.AZURE_BLOB_ACCOUNTS_JSON) {
    ctx.addIssue({
      code: 'custom',
      path: ['AZURE_BLOB_ACCOUNTS_JSON'],
      message:
        "AZURE_BLOB_ACCOUNTS_JSON must be set when IMAGE_UPLOAD_PROVIDER='azure'",
    })
    return
  }

  // The field-level .refine already surfaces a parse error; nothing to add here.
  const parsed = parseAzureAccounts(data.AZURE_BLOB_ACCOUNTS_JSON)
  if (parsed === null) return

  if (parsed.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['AZURE_BLOB_ACCOUNTS_JSON'],
      message:
        "AZURE_BLOB_ACCOUNTS_JSON must contain at least one account when IMAGE_UPLOAD_PROVIDER='azure'",
    })
    return
  }

  if (!data.AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS) return

  const aliases = parsed
    .map((item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).alias === 'string'
        ? ((item as Record<string, unknown>).alias as string)
        : null
    )
    .filter((alias): alias is string => alias !== null)

  if (!aliases.includes(data.AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS)) {
    ctx.addIssue({
      code: 'custom',
      path: ['AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS'],
      message:
        'AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS must match an alias in AZURE_BLOB_ACCOUNTS_JSON',
    })
  }
}

const RAZORPAY_REQUIRED_KEYS = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const

const validateRazorpay = (data: EnvData, ctx: z.RefinementCtx) => {
  if (data.PAYMENT_PROVIDER !== 'RAZORPAY') return

  RAZORPAY_REQUIRED_KEYS.forEach((key) => {
    if (!data[key]?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} must be set when PAYMENT_PROVIDER='RAZORPAY'`,
      })
    }
  })
}

const BaseEnvSchema = z.object({
  DATABASE_URL: z.string(),
  READ_DATABASE_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  AUTH_TRUST_HOST: z.enum(['true', 'false']).optional(),
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  MAILERSEND_API_KEY: z.string().optional(),
  MAILERSEND_FROM_EMAIL: z.string().optional(),
  GOOGLE_SMTP_HOST: z.string().optional(),
  GOOGLE_SMTP_PORT: z.string().optional(),
  GOOGLE_SMTP_SECURE: z.enum(['true', 'false']).optional(),
  GOOGLE_SMTP_USER: z.string().optional(),
  GOOGLE_SMTP_APP_PASSWORD: z.string().optional(),
  GOOGLE_SMTP_FROM_EMAIL: z.string().optional(),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  UPSTASH_SEARCH_REST_URL: z.url().optional(),
  UPSTASH_SEARCH_REST_TOKEN: z.string().optional(),
  UPSTASH_SEARCH_REST_READONLY_TOKEN: z.string().optional(),
  NEXT_PUBLIC_UPSTASH_SEARCH_REST_URL: z.url().optional(),
  NEXT_PUBLIC_UPSTASH_SEARCH_REST_READONLY_TOKEN: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(['RAZORPAY']).optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.url().optional(),
  IMAGE_UPLOAD_PROVIDER: z.enum(['vercel', 'azure']).optional(),
  AZURE_BLOB_ACCOUNTS_JSON: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (value === undefined || value === '') return true
        let parsed: unknown
        try {
          parsed = JSON.parse(value)
        } catch {
          return false
        }
        if (!Array.isArray(parsed)) return false
        return parsed.every(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as Record<string, unknown>).alias === 'string' &&
            typeof (item as Record<string, unknown>).connectionString ===
              'string' &&
            typeof (item as Record<string, unknown>).container === 'string'
        )
      },
      {
        message:
          'AZURE_BLOB_ACCOUNTS_JSON must be a JSON array of objects with string alias, connectionString, and container properties.',
      }
    ),
  AZURE_BLOB_DEFAULT_ACCOUNT_ALIAS: z.string().optional(),
  AZURE_BLOB_AUTO_CREATE_CONTAINER: z.enum(['true', 'false']).optional(),
})

export const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  validateProductionKeys(data, ctx)
  validateAzureBlob(data, ctx)
  validateRazorpay(data, ctx)
})

export type Env = z.infer<typeof EnvSchema>
