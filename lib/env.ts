import { EnvSchema, type Env } from "./validations";

// Validate environment variables at import time
const parseResult = EnvSchema.safeParse(process.env);

if (!parseResult.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parseResult.error.issues, null, 2)}`,
  );
}

// Export typed and validated environment variables
export const env: Env = parseResult.data;
