import { z } from "zod";

// Keys that must be present in production (outside of the build phase).
const QSTASH_REQUIRED_KEYS = [
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

export const EnvSchema = z
  .object({
    DATABASE_URL: z.string(),
    READ_DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    EXCHANGE_RATE_API_KEY: z.string().optional(),
    MAILERSEND_API_KEY: z.string().optional(),
    MAILERSEND_FROM_EMAIL: z.string().optional(),
    GOOGLE_SMTP_HOST: z.string().optional(),
    GOOGLE_SMTP_PORT: z.string().optional(),
    GOOGLE_SMTP_SECURE: z.enum(["true", "false"]).optional(),
    GOOGLE_SMTP_USER: z.string().optional(),
    GOOGLE_SMTP_APP_PASSWORD: z.string().optional(),
    GOOGLE_SMTP_FROM_EMAIL: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    UPSTASH_SEARCH_REST_URL: z.string().url().optional(),
    UPSTASH_SEARCH_REST_TOKEN: z.string().optional(),
    UPSTASH_SEARCH_REST_READONLY_TOKEN: z.string().optional(),
    NEXT_PUBLIC_UPSTASH_SEARCH_REST_URL: z.string().url().optional(),
    NEXT_PUBLIC_UPSTASH_SEARCH_REST_READONLY_TOKEN: z.string().optional(),
    VERCEL_AI_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Skip production-only checks during build phase (next build sets NODE_ENV=production)
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (data.NODE_ENV === "production" && !isBuildPhase) {
      QSTASH_REQUIRED_KEYS.forEach((key) => {
        if (!data[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required in production`,
          });
        }
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;
