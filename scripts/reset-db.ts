/**
 * Drop all tables in the public schema so we can run migrations from scratch.
 * Run with: npx tsx scripts/reset-db.ts
 */
/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("Dropping all tables, enums, and drizzle metadata...\n");

  // Drop all tables in public schema using CASCADE
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
        RAISE NOTICE 'Dropped table %', r.tablename;
      END LOOP;
    END $$;
  `);

  // Drop custom enums
  await pool.query(`DROP TYPE IF EXISTS "public"."OrderStatus" CASCADE`);
  await pool.query(`DROP TYPE IF EXISTS "public"."UserRole" CASCADE`);

  console.log("All tables and enums dropped successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
