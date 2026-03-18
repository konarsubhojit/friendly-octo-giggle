/**
 * Re-insert exported product data back into the database.
 * Run with: npx tsx scripts/import-product-data.ts
 */
/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const sqlFile = join(
    process.cwd(),
    "drizzle",
    "data-export",
    "product-data.sql",
  );
  const sql = readFileSync(sqlFile, "utf-8");

  // Extract INSERT statements using regex
  const statements = [...sql.matchAll(/INSERT INTO[\s\S]*?;\s*/g)].map((m) =>
    m[0].trim(),
  );

  for (const stmt of statements) {
    console.log(`Executing: ${stmt.substring(0, 80)}...`);
    await pool.query(stmt);
  }

  // Verify
  const { rows: products } = await pool.query(
    `SELECT COUNT(*) as count FROM "Product"`,
  );
  const { rows: variations } = await pool.query(
    `SELECT COUNT(*) as count FROM "ProductVariation"`,
  );
  console.log(
    `\nInserted: ${products[0].count} products, ${variations[0].count} variations`,
  );

  await pool.end();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
