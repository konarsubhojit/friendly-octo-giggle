import { EnvSchema, type Env } from './validations/env'

const isProductionBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build'

const envWithLegacyAliases = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.database_url,
  READ_DATABASE_URL:
    process.env.READ_DATABASE_URL ?? process.env.read_database_url,
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
