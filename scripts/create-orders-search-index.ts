/* eslint-disable no-console */

import process from "node:process";

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env", override: false });

const { createOrRefreshOrdersSearchIndex } =
  await import("../src/features/orders/services/orders-search-index");

try {
  const result = await createOrRefreshOrdersSearchIndex();

  if (result.indexCreated) {
    console.log('Created Redis Search index "orders".');
  } else {
    console.log('Redis Search index "orders" already exists.');
  }

  console.log(`Backfilled ${result.indexedOrders} orders into Redis.`);
  console.log("Orders Redis search index is ready.");
} catch (error) {
  console.error("Failed to create or backfill the orders Redis search index.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
