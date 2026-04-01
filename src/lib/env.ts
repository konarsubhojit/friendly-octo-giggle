import { EnvSchema, type Env } from "./validations/env";

const isProductionBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build";

const envToValidate =
  isProductionBuildPhase && !process.env.DATABASE_URL
    ? {
        ...process.env,
        DATABASE_URL: "postgresql://BUILD_TIME_PLACEHOLDER_DO_NOT_USE",
      }
    : process.env;

// Validate environment variables at import time
const parseResult = EnvSchema.safeParse(envToValidate);

if (!parseResult.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parseResult.error.issues, null, 2)}`,
  );
}

// Export typed and validated environment variables
export const env: Env = parseResult.data;
