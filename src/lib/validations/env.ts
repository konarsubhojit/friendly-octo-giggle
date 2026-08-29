import { z } from 'zod'
import { PAYMENT_PROVIDERS } from '@/lib/payments/providers'
import { resolveProviders } from '@/lib/providers/resolution'
import {
  CACHE_PROVIDERS,
  CONFIG_PROVIDERS,
  DATABASE_DRIVERS,
  JOBS_PROVIDERS,
  RATE_LIMIT_PROVIDERS,
  SEARCH_PROVIDERS,
  STORAGE_PROVIDERS,
} from '@/lib/providers/types'

// Keys that must be present in production (outside of the build phase).
const PRODUCTION_REQUIRED_KEYS = ['NEXT_PUBLIC_APP_URL'] as const

const AUTH_REQUIRED_KEYS = ['NEXTAUTH_SECRET'] as const

type EnvData = z.infer<typeof BaseEnvSchema>

const validateProductionKeys = (data: EnvData, ctx: z.RefinementCtx) => {
  // Skip production-only checks during build phase (next build sets NODE_ENV=production)
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  if (data.NODE_ENV !== 'production' || isBuildPhase) return

  PRODUCTION_REQUIRED_KEYS.forEach((key) => {
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

/**
 * Reject provider selections whose credentials are incomplete.
 *
 * The selection itself, and the required-key list behind it, come from the one
 * resolution path in `@/lib/providers/resolution` — this refinement only
 * translates its issues into field-scoped Zod errors, so code, tests, and
 * documentation share a single precedence table.
 *
 * Deferred during `next build` for the same reason the production-key checks
 * are: a build machine legitimately has no runtime credentials.
 */
const validateProviders = (data: EnvData, ctx: z.RefinementCtx) => {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  if (isBuildPhase) return

  resolveProviders(data).issues.forEach((issue) => {
    ctx.addIssue({
      code: 'custom',
      path: [issue.field],
      message: issue.message,
    })
  })
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

const validateInngest = (data: EnvData, ctx: z.RefinementCtx) => {
  // Publishing checkout events without a signing key would produce runs the
  // serve endpoint cannot authenticate, stranding every checkout request.
  if (!data.INNGEST_EVENT_KEY?.trim()) return
  if (data.INNGEST_SIGNING_KEY?.trim()) return

  ctx.addIssue({
    code: 'custom',
    path: ['INNGEST_SIGNING_KEY'],
    message: 'INNGEST_SIGNING_KEY must be set when INNGEST_EVENT_KEY is set',
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
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  UPSTASH_SEARCH_REST_URL: z.url().optional(),
  UPSTASH_SEARCH_REST_TOKEN: z.string().optional(),
  UPSTASH_SEARCH_REST_READONLY_TOKEN: z.string().optional(),
  NEXT_PUBLIC_UPSTASH_SEARCH_REST_URL: z.url().optional(),
  NEXT_PUBLIC_UPSTASH_SEARCH_REST_READONLY_TOKEN: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(PAYMENT_PROVIDERS).optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.url().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  DATABASE_DRIVER: z.enum(DATABASE_DRIVERS).optional(),
  CACHE_PROVIDER: z.enum(CACHE_PROVIDERS).optional(),
  SEARCH_PROVIDER: z.enum(SEARCH_PROVIDERS).optional(),
  RATE_LIMIT_PROVIDER: z.enum(RATE_LIMIT_PROVIDERS).optional(),
  CONFIG_PROVIDER: z.enum(CONFIG_PROVIDERS).optional(),
  JOBS_PROVIDER: z.enum(JOBS_PROVIDERS).optional(),
  EDGE_CONFIG: z.string().optional(),
  ALGOLIA_APP_ID: z.string().optional(),
  ALGOLIA_API_KEY: z.string().optional(),
  ALGOLIA_INDEX_NAME: z.string().optional(),
  STORAGE_PROVIDER: z.enum(STORAGE_PROVIDERS).optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
})

export const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  validateProductionKeys(data, ctx)
  validateProviders(data, ctx)
  validateRazorpay(data, ctx)
  validateInngest(data, ctx)
})

export type Env = z.infer<typeof EnvSchema>
