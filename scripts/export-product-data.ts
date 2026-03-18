/**
 * Export product-related data from the database as SQL INSERT statements.
 * Run with: npx tsx scripts/export-product-data.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { Pool } from "@neondatabase/serverless";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "object") {
    // JSON columns
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
  }
  // String — escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildInsertSQL(
  tableName: string,
  rows: Record<string, unknown>[],
): string {
  if (rows.length === 0) return `-- No data in ${tableName}\n`;
  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const valueLines = rows.map((row) => {
    const vals = columns.map((c) => escapeSQL(row[c])).join(", ");
    return `  (${vals})`;
  });
  return `INSERT INTO "${tableName}" (${colList}) VALUES\n${valueLines.join(",\n")};\n`;
}

async function main() {
  const outDir = join(process.cwd(), "drizzle", "data-export");
  mkdirSync(outDir, { recursive: true });

  console.log("Exporting Product data...");
  const { rows: products } = await pool.query(
    `SELECT "id", "name", "description", "price", "image", "images", "stock", "category", "deletedAt", "createdAt", "updatedAt" FROM "Product" ORDER BY "createdAt"`,
  );
  console.log(`  Found ${products.length} products`);

  console.log("Exporting ProductVariation data...");
  const { rows: variations } = await pool.query(
    `SELECT "id", "productId", "name", "designName", "image", "images", "priceModifier", "stock", "createdAt", "updatedAt" FROM "ProductVariation" ORDER BY "productId", "createdAt"`,
  );
  console.log(`  Found ${variations.length} product variations`);

  const sql = [
    "-- Product data export",
    `-- Exported at: ${new Date().toISOString()}`,
    "",
    "-- Products",
    buildInsertSQL("Product", products),
    "-- Product Variations",
    buildInsertSQL("ProductVariation", variations),
  ].join("\n");

  const outFile = join(outDir, "product-data.sql");
  writeFileSync(outFile, sql, "utf-8");
  console.log(`\nExported to: ${outFile}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
