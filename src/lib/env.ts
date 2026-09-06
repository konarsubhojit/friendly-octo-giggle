import { EnvSchema, type Env } from './validations/env'

const isProductionBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build'

const r2AccountId = process.env.R2_ACCOUNT_ID?.trim()

const envWithLegacyAliases = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.database_url,
  READ_DATABASE_URL:
    process.env.READ_DATABASE_URL ?? process.env.read_database_url,
  S3_REGION: process.env.S3_REGION ?? (r2AccountId ? 'auto' : undefined),
  S3_BUCKET: process.env.S3_BUCKET ?? process.env.R2_BUCKET,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY:
    process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY,
  S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE_URL,
  S3_ENDPOINT:
    process.env.S3_ENDPOINT ??
    (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined),
  S3_FORCE_PATH_STYLE:
    process.env.S3_FORCE_PATH_STYLE ?? (r2AccountId ? 'true' : undefined),
}

const envToValidate =
  isProductionBuildPhase && !envWithLegacyAliases.DATABASE_URL
    ? {
        ...envWithLegacyAliases,
        DATABASE_URL: 'postgresql://BUILD_TIME_PLACEHOLDER_DO_NOT_USE',
      }
    : envWithLegacyAliases

// Validate environment variables at import time
const parseResult = EnvSchema.safeParse(envToValidate)

if (!parseResult.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parseResult.error.issues, null, 2)}`
  )
}

// Export typed and validated environment variables
export const env: Env = parseResult.data
