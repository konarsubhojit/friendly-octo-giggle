import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local first (Next.js convention for local secrets), then fall back to .env.
// This ensures DATABASE_URL from .env.local is available to drizzle-kit commands.
config({ path: '.env.local' });
config({ path: '.env', override: false });

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
