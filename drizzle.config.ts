import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local first — it takes precedence over .env and is excluded from
// version control (Next.js convention). Then load .env as a fallback for
// defaults and CI-injected values. This ensures DATABASE_URL is available to
// drizzle-kit commands without requiring a manual `export` step.
config({ path: '.env.local' });
config({ path: '.env', override: false });

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
